import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
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
  addBlock: (type: SectionType, title?: string) => Promise<void>
  removeBlock: (blockId: string) => Promise<void>
  updateBlock: (block: ResumeBlock) => Promise<void>
  toggleBlock: (blockId: string, enabled: boolean) => Promise<void>
  reorderBlocks: (fromIndex: number, toIndex: number) => Promise<void>
  insertBlock: (block: Omit<ResumeBlock, 'id'>) => Promise<void>
  updateProfile: (patch: Partial<Resume['profile']>) => Promise<void>
  setTemplate: (templateId: TemplateId) => Promise<void>
  /** Replace the whole resume, e.g. with a restored version's content. */
  replaceResume: (next: Resume) => Promise<void>
}

/**
 * Reads and mutates the active resume. All writes go through ResumeStore.
 *
 * With no id it opens the user's first resume: in Supabase mode ids are
 * assigned by the database, so there is no fixed id to ask for.
 */
export function useResume(resumeId?: string): UseResumeResult {
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

  const api = useMemo(() => {
    const apply = async (run: (id: string) => Promise<Resume>) => {
      try {
        if (!activeId) throw new Error('No resume is open yet')
        const next = await run(activeId)
        setResume(next)
        setResumes((prev) => prev.map((r) => (r.id === next.id ? next : r)))
        setError(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Update failed')
      }
    }
    return {
      addBlock: (type: SectionType, title?: string) =>
        apply((id) => resumeStore.addBlock(id, type, title)),
      removeBlock: (blockId: string) => apply((id) => resumeStore.removeBlock(id, blockId)),
      updateBlock: (block: ResumeBlock) => apply((id) => resumeStore.updateBlock(id, block)),
      toggleBlock: (blockId: string, enabled: boolean) =>
        apply((id) => resumeStore.toggleBlock(id, blockId, enabled)),
      reorderBlocks: (fromIndex: number, toIndex: number) =>
        apply((id) => resumeStore.reorderBlocks(id, fromIndex, toIndex)),
      insertBlock: (block: Omit<ResumeBlock, 'id'>) =>
        apply((id) => resumeStore.insertBlock(id, block)),
      updateProfile: (patch: Partial<Resume['profile']>) =>
        apply((id) => resumeStore.updateProfile(id, patch)),
      setTemplate: (templateId: TemplateId) =>
        apply((id) => resumeStore.setTemplate(id, templateId)),
      replaceResume: (next: Resume) => apply((id) => resumeStore.save({ ...next, id })),
    }
  }, [resumeStore, activeId])

  return { resume, resumes, loading, error, ...api }
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
