"use client"

import { useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
import { UserRow } from "./user-row"

interface Payment {
  id: string
  ref_command: string
  amount: number
  currency: string
  payment_method: string | null
  status: string
  user_email: string
  item_name: string | null
  created_at: string
  completed_at: string | null
}

interface UsersTableProps {
  users: Array<Record<string, unknown>>
  paymentsByEmail: Record<string, Payment[]>
  favoritesCounts: Record<string, number>
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function UsersTable({ users, paymentsByEmail, favoritesCounts }: UsersTableProps) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const name = String(u.name || "").toLowerCase()
      const email = String(u.email || "").toLowerCase()
      const role = String(u.role || "").toLowerCase()
      const plan = String(u.plan || "").toLowerCase()
      const beta = u.is_beta_tester ? "beta bêta beta-tester" : ""
      return (
        name.includes(q) ||
        email.includes(q) ||
        role.includes(q) ||
        plan.includes(q) ||
        beta.includes(q)
      )
    })
  }, [users, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const end = start + pageSize
  const pageRows = filtered.slice(start, end)

  return (
    <div className="space-y-4">
      {/* Search + page size */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Rechercher (nom, email, rôle, plan)…"
            className="pl-9"
            aria-label="Rechercher des utilisateurs"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          </span>
          <span className="hidden sm:inline">·</span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Par page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Bêta</TableHead>
              <TableHead>Accès</TableHead>
              <TableHead>Abonnement</TableHead>
              <TableHead>Favoris</TableHead>
              <TableHead>Inscription</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Aucun utilisateur trouvé.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((user) => (
                <UserRow
                  key={user.id as string}
                  user={user}
                  payments={paymentsByEmail[user.email as string] || []}
                  favoritesCount={favoritesCounts[user.id as string] || 0}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {filtered.length === 0
            ? "0 sur 0"
            : `${start + 1}–${Math.min(end, filtered.length)} sur ${filtered.length}`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <span className="text-sm tabular-nums">
            Page {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
