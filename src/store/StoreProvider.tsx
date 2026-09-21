import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Application, ApplicationDraft, Resume, ResumeBlock, SectionType } from '../types'
import { InMemoryApplicationStore, InMemoryResumeStore } from './memoryStore'
import type { ApplicationStore, ResumeStore } from './types'

interface StoreContextValue {
  resumeStore: ResumeStore
  applicationStore: ApplicationStore
}

const StoreContext = createContext<StoreContextValue | null>(null)

interface StoreProviderProps {
  children: ReactNode
  /** Injectable for tests; defaults to the in-memory implementations. */
  resumeStore?: ResumeStore
  applicationStore?: ApplicationStore
}

export function StoreProvider({
  children,
  resumeStore,
  applicationStore,
}: StoreProviderProps) {
  // TODO(iteration-2): swap these for Supabase-backed stores.
  const value = useMemo<StoreContextValue>(
    () => ({
      resumeStore: resumeStore ?? new InMemoryResumeStore(),
      applicationStore: applicationStore ?? new InMemoryApplicationStore(),
    }),
    [resumeStore, applicationStore],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

function useStores(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStores must be used inside a StoreProvider')
  return ctx
}

export interface UseResumeResult {
  resume: Resume | undefined
  resumes: Resume[]
  loading: boolean
  error: string | null
  addBlock: (type: SectionType) => Promise<void>
  removeBlock: (blockId: string) => Promise<void>
  updateBlock: (block: ResumeBlock) => Promise<void>
  toggleBlock: (blockId: string, enabled: boolean) => Promise<void>
  reorderBlocks: (fromIndex: number, toIndex: number) => Promise<void>
  updateProfile: (patch: Partial<Resume['profile']>) => Promise<void>
}

/** Reads and mutates the active resume. All writes go through ResumeStore. */
export function useResume(resumeId = 'r1'): UseResumeResult {
  const { resumeStore } = useStores()
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resume, setResume] = useState<Resume | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([resumeStore.list(), resumeStore.get(resumeId)])
      .then(([all, one]) => {
        if (cancelled) return
        setResumes(all)
        setResume(one)
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
    const apply = async (op: Promise<Resume>) => {
      try {
        const next = await op
        setResume(next)
        setResumes((prev) => prev.map((r) => (r.id === next.id ? next : r)))
        setError(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Update failed')
      }
    }
    return {
      addBlock: (type: SectionType) => apply(resumeStore.addBlock(resumeId, type)),
      removeBlock: (blockId: string) => apply(resumeStore.removeBlock(resumeId, blockId)),
      updateBlock: (block: ResumeBlock) => apply(resumeStore.updateBlock(resumeId, block)),
      toggleBlock: (blockId: string, enabled: boolean) =>
        apply(resumeStore.toggleBlock(resumeId, blockId, enabled)),
      reorderBlocks: (fromIndex: number, toIndex: number) =>
        apply(resumeStore.reorderBlocks(resumeId, fromIndex, toIndex)),
      updateProfile: (patch: Partial<Resume['profile']>) =>
        apply(resumeStore.updateProfile(resumeId, patch)),
    }
  }, [resumeStore, resumeId])

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
