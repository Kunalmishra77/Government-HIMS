"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Search, Columns3, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, X, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface ProColumn<T> {
  key: string
  label: string
  className?: string
  align?: "left" | "right" | "center"
  render?: (row: T, index: number) => ReactNode
  /** Enable click-to-sort on this column's header. */
  sortable?: boolean
  /** Value used for sorting (defaults to the row[key] value). */
  sortAccessor?: (row: T) => string | number
  hideOnMobile?: boolean
  /** First such column becomes the card title in the mobile view. */
  primary?: boolean
  /** Hidden by default; can be re-enabled from Manage Columns. */
  defaultHidden?: boolean
  /** Cannot be toggled off in Manage Columns (e.g. the name column). */
  lockedVisible?: boolean
}

interface DataTableProProps<T> {
  columns: ProColumn<T>[]
  data: T[]
  keyField: keyof T
  onRowClick?: (row: T) => void
  title?: string
  itemNoun?: string
  searchKeys?: (keyof T)[]
  searchPlaceholder?: string
  filterChips?: { label: string; onRemove?: () => void }[]
  onClearFilters?: () => void
  /** Extra filter controls rendered on the toolbar's left. */
  toolbarLeft?: ReactNode
  /** Primary actions rendered on the toolbar's right (e.g. "Register patient"). */
  toolbarActions?: ReactNode
  selectable?: boolean
  bulkActions?: (rows: T[], clear: () => void) => ReactNode
  pageSizeOptions?: number[]
  initialPageSize?: number
  emptyState?: ReactNode
  className?: string
  showColumnManager?: boolean
}

const alignCls = (a?: "left" | "right" | "center") =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left"

function keyStr(v: unknown): string { return String(v) }

export function DataTablePro<T>({
  columns,
  data,
  keyField,
  onRowClick,
  title,
  itemNoun = "results",
  searchKeys,
  searchPlaceholder = "Search",
  filterChips = [],
  onClearFilters,
  toolbarLeft,
  toolbarActions,
  selectable = false,
  bulkActions,
  pageSizeOptions = [10, 25, 50],
  initialPageSize = 10,
  emptyState,
  className,
  showColumnManager = true,
}: DataTableProProps<T>) {
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter(c => c.defaultHidden).map(c => c.key)),
  )
  const [colMenu, setColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!colMenu) return
    const onDoc = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenu(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [colMenu])

  const visibleCols = columns.filter(c => !hidden.has(c.key))
  const primaryCol = visibleCols.find(c => c.primary) ?? visibleCols[0]

  // ── search → sort ─────────────────────────────────────────────────────────
  const searched = useMemo(() => {
    if (!query.trim() || !searchKeys?.length) return data
    const q = query.toLowerCase()
    return data.filter(row =>
      searchKeys.some(k => keyStr((row as Record<string, unknown>)[k as string] ?? "").toLowerCase().includes(q)),
    )
  }, [data, query, searchKeys])

  const sorted = useMemo(() => {
    if (!sortKey) return searched
    const col = columns.find(c => c.key === sortKey)
    if (!col) return searched
    const accessor = col.sortAccessor ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number)
    const dir = sortDir === "asc" ? 1 : -1
    return [...searched].sort((a, b) => {
      const av = accessor(a), bv = accessor(b)
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
      return keyStr(av).localeCompare(keyStr(bv), undefined, { numeric: true }) * dir
    })
  }, [searched, sortKey, sortDir, columns])

  const total = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount)
  const start = (current - 1) * pageSize
  const paged = sorted.slice(start, start + pageSize)

  const toggleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); return }
    if (sortDir === "asc") { setSortDir("desc"); return }
    setSortKey(null)
  }

  const allSelected = sorted.length > 0 && sorted.every(r => selected.has(keyStr(r[keyField])))
  const toggleAll = () => {
    setSelected(() => allSelected ? new Set() : new Set(sorted.map(r => keyStr(r[keyField]))))
  }
  const toggleOne = (k: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })
  const clearSelection = () => setSelected(new Set())
  const selectedRows = useMemo(() => sorted.filter(r => selected.has(keyStr(r[keyField]))), [sorted, selected, keyField])

  const isEmpty = total === 0
  const togglableCols = columns.filter(c => !c.lockedVisible)

  return (
    <div className={cn("rounded-2xl border border-border bg-surface shadow-card overflow-hidden", className)}>
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          {title && <h3 className="t-title text-foreground truncate">{title}</h3>}
          <span className="t-caption text-foreground-lighter tabular-nums">({total})</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {searchKeys?.length ? (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-placeholder" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setPage(1) }}
                placeholder={searchPlaceholder}
                className="h-9 w-44 sm:w-56 pl-8 pr-3 rounded-lg border border-border bg-surface text-sm text-foreground placeholder:text-foreground-placeholder focus:outline-none focus:border-[var(--color-border-focus)] focus:shadow-[var(--shadow-focus)]"
              />
            </div>
          ) : null}

          {toolbarLeft}

          {showColumnManager && (
            <div className="relative" ref={colMenuRef}>
              <button onClick={() => setColMenu(v => !v)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-surface text-sm font-semibold text-foreground-muted hover:bg-surface-sunken transition-colors cursor-pointer">
                <Columns3 className="h-4 w-4" /> <span className="hidden sm:inline">Columns</span>
              </button>
              {colMenu && (
                <div className="absolute right-0 mt-1.5 z-30 w-52 rounded-xl border border-border bg-surface shadow-modal p-1.5">
                  <p className="t-overline text-foreground-lighter px-2 py-1.5">Manage columns</p>
                  {togglableCols.map(c => {
                    const on = !hidden.has(c.key)
                    return (
                      <button key={c.key} onClick={() => setHidden(prev => {
                        const next = new Set(prev)
                        if (next.has(c.key)) next.delete(c.key); else next.add(c.key)
                        return next
                      })}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-foreground-muted hover:bg-surface-sunken cursor-pointer">
                        <span className={cn("h-4 w-4 rounded border flex items-center justify-center flex-shrink-0",
                          on ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white" : "border-border-strong")}>
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {toolbarActions}
        </div>
      </div>

      {/* ── Filter chips ────────────────────────────────────────── */}
      {filterChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 border-b border-border bg-surface-sunken/60">
          <span className="t-caption text-foreground-lighter">
            {total} {itemNoun} for
          </span>
          {filterChips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-surface border border-border text-[12.5px] font-semibold text-foreground-muted">
              {chip.label}
              {chip.onRemove && (
                <button onClick={chip.onRemove} aria-label={`Remove ${chip.label}`} className="h-4 w-4 rounded-full hover:bg-surface-sunken flex items-center justify-center cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {onClearFilters && (
            <button onClick={onClearFilters} className="text-[12.5px] font-semibold text-[var(--color-accent)] hover:underline cursor-pointer">Clear all</button>
          )}
        </div>
      )}

      {/* ── Bulk action bar ─────────────────────────────────────── */}
      {selectable && selectedRows.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-[var(--color-primary)]/[0.06]">
          <span className="text-sm font-semibold text-foreground">{selectedRows.length} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            {bulkActions?.(selectedRows, clearSelection)}
            <button onClick={clearSelection} className="text-sm font-semibold text-foreground-lighter hover:text-foreground-muted cursor-pointer">Clear</button>
          </div>
        </div>
      )}

      {/* ── Desktop table ───────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken border-b border-border">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all"
                    className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary)] cursor-pointer" />
                </th>
              )}
              {visibleCols.map(col => (
                <th key={col.key} scope="col"
                  className={cn("px-4 py-3.5 t-overline text-foreground-lighter whitespace-nowrap", alignCls(col.align), col.className)}>
                  {col.sortable ? (
                    <button onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 hover:text-foreground-muted cursor-pointer uppercase">
                      {col.label}
                      {sortKey === col.key
                        ? (sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
                        : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {isEmpty ? (
              <tr>
                <td colSpan={visibleCols.length + (selectable ? 1 : 0)} className="py-12 text-center text-foreground-placeholder">
                  {emptyState ?? <span className="t-body">No data</span>}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => {
                const k = keyStr(row[keyField])
                return (
                  <tr key={k} onClick={() => onRowClick?.(row)}
                    className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-surface-sunken", selected.has(k) && "bg-[var(--color-primary)]/[0.04]")}>
                    {selectable && (
                      <td className="w-10 px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(k)} onChange={() => toggleOne(k)} aria-label="Select row"
                          className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary)] cursor-pointer" />
                      </td>
                    )}
                    {visibleCols.map(col => (
                      <td key={col.key} className={cn("px-4 py-3.5 text-foreground-muted align-middle", alignCls(col.align), col.className)}>
                        {col.render ? col.render(row, start + i) : keyStr((row as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile stacked cards ────────────────────────────────── */}
      <div className="md:hidden divide-y divide-border-light">
        {isEmpty ? (
          <div className="py-12 text-center text-foreground-placeholder">{emptyState ?? <span className="t-body">No data</span>}</div>
        ) : (
          paged.map((row, i) => {
            const k = keyStr(row[keyField])
            return (
              <div key={k} className={cn("w-full text-left p-4 flex flex-col gap-2", onRowClick && "hover:bg-surface-sunken transition-colors")}
                onClick={() => onRowClick?.(row)}>
                <div className="t-title text-foreground">{primaryCol?.render ? primaryCol.render(row, start + i) : keyStr((row as Record<string, unknown>)[primaryCol?.key ?? ""] ?? "")}</div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {visibleCols.filter(c => c !== primaryCol && !c.hideOnMobile).map(col => (
                    <div key={col.key} className="min-w-0">
                      <dt className="t-caption text-foreground-lighter">{col.label}</dt>
                      <dd className="t-body text-foreground-muted truncate">
                        {col.render ? col.render(row, start + i) : keyStr((row as Record<string, unknown>)[col.key] ?? "")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })
        )}
      </div>

      {/* ── Pagination footer ───────────────────────────────────── */}
      {!isEmpty && (
        <div className="flex items-center gap-3 flex-wrap px-4 py-3 border-t border-border">
          <p className="t-caption text-foreground-lighter tabular-nums">
            Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <label className="t-caption text-foreground-lighter">Per page</label>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="h-8 rounded-lg border border-border bg-surface text-sm text-foreground px-2 cursor-pointer focus:outline-none focus:border-[var(--color-border-focus)]">
              {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={current <= 1}
                className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-foreground-muted hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="t-caption text-foreground-muted tabular-nums px-1.5">{current} / {pageCount}</span>
              <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={current >= pageCount}
                className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-foreground-muted hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
