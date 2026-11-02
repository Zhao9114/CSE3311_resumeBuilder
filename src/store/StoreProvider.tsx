import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type {
  Application,
  ApplicationDraft,
  Resume,
  ResumeBlock,
  ResumeVersion,
  SavedBlock,
  SavedBlockDraft,
  SectionType,
  TemplateId,
} from '../types'
import {
  InMemoryApplicationStore,
  InMemoryBlockLibraryStore,
  InMemoryResumeStore,
  InMemoryResumeVersionStore,
} from './memoryStore'
import * as ops from './resumeOps'
import {
  isSyncStatusSource,
  type ApplicationStore,
  type BlockLibraryStore,
  type ResumeStore,
  type ResumeVersionStore,
  type SyncStatus,
} from './types'

export interface StoreSet {
  resumeStore: ResumeStore
  applicationStore: ApplicationStore
  blockLibraryStore: BlockLibraryStore
  versionStore: ResumeVersionStore
}

const StoreContext = createContext<StoreSet | null>(null)

interface StoreProviderProps extends Partial<StoreSet> {
  children: ReactNode
}

/**
 * Supplies the data stores to every hook below it. With no props it uses the
 * in-memory stores (demo mode, tests); `main.tsx` passes Supabase-backed ones
 * once a user is signed in. Components can't tell the difference.
 */
export function StoreProvider({
  children,
  resumeStore,
  applicationStore,
  blockLibraryStore,
  versionStore,
}: StoreProviderProps) {
  const value = useMemo<StoreSet>(
    () => ({
      resumeStore: resumeStore ?? new InMemoryResumeStore(),
      applicationStore: applicationStore ?? new InMemoryApplicationStore(),
      blockLibraryStore: blockLibraryStore ?? new InMemoryBlockLibraryStore(),
      versionStore: versionStore ?? new InMemoryResumeVersionStore(),
    }),
    [resumeStore, applicationStore, blockLibraryStore, versionStore],
  )

  // A background-saving store may still hold edits when the tab closes.
  // Start the write and ask the browser to confirm leaving.
  useEffect(() => {
    const store = value.resumeStore
    if (!isSyncStatusSource(store)) return
    const source = store
    function onBeforeUnload(e: BeforeUnloadEvent) {
      const status = source.getSyncStatus()
      if (status === 'saving' || status === 'error') {
        void source.flush()
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [value.resumeStore])

  return (
    <StoreContext.Provider value={value}>
      <ResumeSession>{children}</ResumeSession>
    </StoreContext.Provider>
  )
}

function useStores(): StoreSet {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStores must be used inside a StoreProvider')
  return ctx
}

export interface UseResumeResult {
  resume: Resume | undefined
  resumes: Resume[]
  loading: boolean
  error: string | null
  addBlock: (type: SectionType, title?: string, atIndex?: number) => Promise<void>
  removeBlock: (blockId: string) => Promise<void>
  updateBlock: (block: ResumeBlock) => Promise<void>
  toggleBlock: (blockId: string, enabled: boolean) => Promise<void>
  reorderBlocks: (fromIndex: number, toIndex: number) => Promise<void>
  insertBlock: (block: Omit<ResumeBlock, 'id'>, atIndex?: number) => Promise<void>
  updateProfile: (patch: Partial<Resume['profile']>) => Promise<void>
  setTemplate: (templateId: TemplateId) => Promise<void>
  /** Replace the whole resume, e.g. with a restored version's content. */
  replaceResume: (next: Resume) => Promise<void>
}

const ResumeContext = createContext<UseResumeResult | null>(null)

/**
 * One shared copy of the open resume for the whole app. The builder, the
 * tracker and the assistant drawer are on screen together, so an edit made
 * in one (say, inserting a block the assistant wrote) must show in the
 * others at once — separate copies would each hold their own stale state.
 */
function ResumeSession({ children }: { children: ReactNode }) {
  const session = useResumeState()
  return <ResumeContext.Provider value={session}>{children}</ResumeContext.Provider>
}

/** Reads and mutates the active resume. All writes go through ResumeStore. */
export function useResume(): UseResumeResult {
  const ctx = useContext(ResumeContext)
  if (!ctx) throw new Error('useResume must be used inside a StoreProvider')
  return ctx
}

/**
 * Opens the user's first resume: in Supabase mode ids are assigned by the
 * database, so there is no fixed id to ask for.
 */
function useResumeState(resumeId?: string): UseResumeResult {
  const { resumeStore } = useStores()
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resume, setResume] = useState<Resume | undefined>()
  const [activeId, setActiveId] = useState<string | undefined>(resumeId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    resumeStore
      .list()
      .then((all) => {
        if (cancelled) return
        const id = resumeId ?? all[0]?.id
        setResumes(all)
        setActiveId(id)
        setResume(all.find((r) => r.id === id))
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load resume')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [resumeStore, resumeId])

  // Bumped on every edit, so a store reply that a newer edit has already
  // overtaken is dropped instead of briefly putting older text back.
  const latestEdit = useRef(0)

  const api = useMemo(() => {
    /**
     * `optimistic` applies the same pure edit to the on-screen copy at once.
     * Form fields read their value from this resume; if it only changed after
     * the store's promise settled, React would reset each field to the old
     * value first and the caret would jump to the end on every keystroke.
     * Adds and inserts skip it: the store assigns their ids.
     */
    const apply = async (run: (id: string) => Promise<Resume>, optimistic?: (r: Resume) => Resume) => {
      const ticket = ++latestEdit.current
      if (optimistic) setResume((prev) => (prev ? optimistic(prev) : prev))
      try {
        if (!activeId) throw new Error('No resume is open yet')
        const next = await run(activeId)
        if (ticket !== latestEdit.current) return
        setResume(next)
        setResumes((prev) => prev.map((r) => (r.id === next.id ? next : r)))
        setError(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Update failed')
      }
    }
    return {
      addBlock: (type: SectionType, title?: string, atIndex?: number) =>
        apply((id) => resumeStore.addBlock(id, type, title, atIndex)),
      removeBlock: (blockId: string) =>
        apply((id) => resumeStore.removeBlock(id, blockId), (r) => ops.removeBlock(r, blockId)),
      updateBlock: (block: ResumeBlock) =>
        apply((id) => resumeStore.updateBlock(id, block), (r) => ops.updateBlock(r, block)),
      toggleBlock: (blockId: string, enabled: boolean) =>
        apply(
          (id) => resumeStore.toggleBlock(id, blockId, enabled),
          (r) => ops.toggleBlock(r, blockId, enabled),
        ),
      reorderBlocks: (fromIndex: number, toIndex: number) =>
        apply(
          (id) => resumeStore.reorderBlocks(id, fromIndex, toIndex),
          (r) => ops.reorderBlocks(r, fromIndex, toIndex),
        ),
      insertBlock: (block: Omit<ResumeBlock, 'id'>, atIndex?: number) =>
        apply((id) => resumeStore.insertBlock(id, block, atIndex)),
      updateProfile: (patch: Partial<Resume['profile']>) =>
        apply((id) => resumeStore.updateProfile(id, patch), (r) => ops.updateProfile(r, patch)),
      setTemplate: (templateId: TemplateId) =>
        apply((id) => resumeStore.setTemplate(id, templateId), (r) => ops.setTemplate(r, templateId)),
      replaceResume: (next: Resume) =>
        apply((id) => resumeStore.save({ ...next, id }), (r) => ({ ...structuredClone(next), id: r.id })),
    }
  }, [resumeStore, activeId])

  return useMemo(
    () => ({ resume, resumes, loading, error, ...api }),
    [resume, resumes, loading, error, api],
  )
}

export interface UseApplicationsResult {
  applications: Application[]
  loading: boolean
  error: string | null
  addApplication: (draft: ApplicationDraft) => Promise<void>
  updateApplication: (id: string, patch: Partial<ApplicationDraft>) => Promise<void>
  removeApplication: (id: string) => Promise<void>
}

/** Reads and mutates tracked applications. All writes go through ApplicationStore. */
export function useApplications(): UseApplicationsResult {
  const { applicationStore } = useStores()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    applicationStore
      .list()
      .then((all) => {
        if (!cancelled) {
          setApplications(all)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load applications')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applicationStore])

  const api = useMemo(() => {
    const refresh = async (op: Promise<unknown>) => {
      try {
        await op
        setApplications(await applicationStore.list())
        setError(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Update failed')
      }
    }
    return {
      addApplication: (draft: ApplicationDraft) => refresh(applicationStore.add(draft)),
      updateApplication: (id: string, patch: Partial<ApplicationDraft>) =>
        refresh(applicationStore.update(id, patch)),
      removeApplication: (id: string) => refresh(applicationStore.remove(id)),
    }
  }, [applicationStore])

  return { applications, loading, error, ...api }
}

export interface UseBlockLibraryResult {
  savedBlocks: SavedBlock[]
  loading: boolean
  error: string | null
  saveBlock: (draft: SavedBlockDraft) => Promise<void>
  renameBlock: (id: string, name: string) => Promise<void>
  removeBlock: (id: string) => Promise<void>
}

/** Reads and mutates the reusable block library. */
export function useBlockLibrary(): UseBlockLibraryResult {
  const { blockLibraryStore } = useStores()
  const [savedBlocks, setSavedBlocks] = useState<SavedBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    blockLibraryStore
      .list()
      .then((all) => {
        if (!cancelled) {
          setSavedBlocks(all)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load library')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [blockLibraryStore])

  const api = useMemo(() => {
    const refresh = async (op: Promise<unknown>) => {
      try {
        await op
        setSavedBlocks(await blockLibraryStore.list())
        setError(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Update failed')
      }
    }
    return {
      saveBlock: (draft: SavedBlockDraft) => refresh(blockLibraryStore.save(draft)),
      renameBlock: (id: string, name: string) =>
        refresh(blockLibraryStore.rename(id, name)),
      removeBlock: (id: string) => refresh(blockLibraryStore.remove(id)),
    }
  }, [blockLibraryStore])

  return { savedBlocks, loading, error, ...api }
}

export interface UseVersionsResult {
  versions: ResumeVersion[]
  loading: boolean
  error: string | null
  /** Freeze `resume` as a new version. Resolves to it, or undefined on failure. */
  saveVersion: (resume: Resume, label: string) => Promise<ResumeVersion | undefined>
}

/** Lists the user's resume versions, newest first, and saves new ones. */
export function useVersions(): UseVersionsResult {
  const { versionStore } = useStores()
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    versionStore
      .list()
      .then((all) => {
        if (!cancelled) {
          setVersions(all)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load versions')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [versionStore])

  const saveVersion = useCallback(
    async (resume: Resume, label: string) => {
      try {
        const created = await versionStore.snapshot(resume, label)
        setVersions((prev) => [created, ...prev])
        setError(null)
        return created
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Saving the version failed')
        return undefined
      }
    },
    [versionStore],
  )

  return { versions, loading, error, saveVersion }
}

const noopSubscribe = () => () => {}

/**
 * The background-save state of the resume store, or null when the store
 * saves synchronously (in-memory demo mode) and there is nothing to show.
 */
export function useSyncStatus(): { status: SyncStatus | null; flush: () => Promise<void> } {
  const { resumeStore } = useStores()
  const source = isSyncStatusSource(resumeStore) ? resumeStore : null
  const subscribe = useCallback(
    (cb: () => void) => (source ? source.subscribe(cb) : noopSubscribe()),
    [source],
  )
  const status = useSyncExternalStore(subscribe, () =>
    source ? source.getSyncStatus() : null,
  )
  const flush = useCallback(() => (source ? source.flush() : Promise.resolve()), [source])
  return { status, flush }
}
