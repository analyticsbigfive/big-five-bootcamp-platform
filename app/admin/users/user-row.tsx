"use client"

import { useState } from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { UserStatusToggle } from "./user-status-toggle"
import { ChevronDown, ChevronRight, CreditCard, Calendar, Clock, Heart, XCircle, RotateCcw, Loader2, Mail, Send, ShieldCheck, ShieldOff, Eye } from "lucide-react"
import { endSubscription, resetSubscription, setUserRole, resetUserViews } from "@/app/actions/user"
import { getPlanDisplayName } from "@/lib/pricing"

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

interface UserRowProps {
    user: Record<string, unknown>
    payments: Payment[]
    favoritesCount: number
}

function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    })
}

function formatDateTime(dateStr: string | null | undefined) {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

function getSubscriptionDaysLeft(endDate: string | null | undefined): number | null {
    if (!endDate) return null
    const end = new Date(endDate)
    const now = new Date()
    // Différence en jours arrondie au plus juste : sous 12h restantes,
    // on tombe à 0 ; pas d'arrondi vers le haut qui ferait croire qu'il
    // reste "1 jour" alors qu'il reste 2 heures.
    const diff = Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
}

/** Heures restantes (utilisé pour l'affichage fin sous 24h). */
function getSubscriptionHoursLeft(endDate: string | null | undefined): number | null {
    if (!endDate) return null
    const end = new Date(endDate)
    const now = new Date()
    return Math.max(0, Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60)))
}

function getPaymentStatusBadge(status: string) {
    switch (status) {
        case 'completed':
            return 'bg-green-100 text-green-800'
        case 'pending':
            return 'bg-yellow-100 text-yellow-800'
        case 'failed':
            return 'bg-red-100 text-red-800'
        case 'canceled':
            return 'bg-slate-100 text-slate-600'
        case 'refunded':
            return 'bg-blue-100 text-blue-800'
        default:
            return 'bg-slate-100 text-slate-600'
    }
}

function getPaymentStatusLabel(status: string) {
    switch (status) {
        case 'completed': return 'Payé'
        case 'pending': return 'En attente'
        case 'failed': return 'Échoué'
        case 'canceled': return 'Annulé'
        case 'refunded': return 'Remboursé'
        default: return status
    }
}

export function UserRow({ user, payments, favoritesCount }: UserRowProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isEndingSubscription, setIsEndingSubscription] = useState(false)
    const [isResettingSubscription, setIsResettingSubscription] = useState(false)
    const [isResettingViews, setIsResettingViews] = useState(false)
    const [isTogglingRole, setIsTogglingRole] = useState(false)
    const [currentRole, setCurrentRole] = useState((user.role as string) || 'user')
    const [isSendingEmail, setIsSendingEmail] = useState(false)
    const [emailSent, setEmailSent] = useState(false)
    const [emailDialogOpen, setEmailDialogOpen] = useState(false)
    const [emailSubject, setEmailSubject] = useState("Nouveautés - Laveiye")
    const [emailMessage, setEmailMessage] = useState("")
    const [resetDays, setResetDays] = useState(30)

    const subStart = user.subscription_start_date as string | null | undefined
    const subEnd = user.subscription_end_date as string | null | undefined
    const daysLeft = getSubscriptionDaysLeft(subEnd)
    const hoursLeft = getSubscriptionHoursLeft(subEnd)
    const hasSubscription = !!subStart
    const isSubscriptionActive = user.subscription_status === 'active' && hoursLeft !== null && hoursLeft > 0

    const handleEndSubscription = async () => {
        if (!confirm(`Mettre fin a l'abonnement de ${user.name || user.email} ?`)) return
        setIsEndingSubscription(true)
        try {
            const result = await endSubscription(user.id as string)
            if (!result.success) {
                alert('Erreur: ' + (result.error || 'Impossible de terminer l\'abonnement'))
            }
        } catch {
            alert('Erreur lors de la mise a jour')
        } finally {
            setIsEndingSubscription(false)
        }
    }

    const openEmailDialog = () => {
        setEmailSubject("Nouveautés - Laveiye")
        setEmailMessage(`Salut ${(user.name as string)?.split(' ')[0] || ''} !\n\nOn a ajouté de nouvelles campagnes sur Laveiye.\nViens les découvrir.\n\nL'équipe Laveiye`)
        setEmailSent(false)
        setEmailDialogOpen(true)
    }

    const handleSendEmail = async () => {
        if (!emailSubject.trim() || !emailMessage.trim()) return
        setIsSendingEmail(true)
        setEmailSent(false)
        try {
            const res = await fetch('/api/admin/send-test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    name: user.name,
                    subject: emailSubject,
                    message: emailMessage,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                alert('Erreur: ' + (data.error || 'Impossible d\'envoyer l\'email'))
            } else {
                setEmailSent(true)
                setTimeout(() => {
                    setEmailDialogOpen(false)
                    setEmailSent(false)
                }, 1500)
            }
        } catch {
            alert('Erreur lors de l\'envoi')
        } finally {
            setIsSendingEmail(false)
        }
    }

    const handleToggleRole = async () => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin'
        const label = user.name || user.email
        if (!confirm(`${newRole === 'admin' ? 'Passer' : 'Retirer le rôle admin de'} ${label} ?`)) return
        setIsTogglingRole(true)
        try {
            const result = await setUserRole(user.id as string, newRole)
            if (result.success) {
                setCurrentRole(newRole)
            } else {
                alert('Erreur : ' + (result.error || 'Impossible de modifier le rôle'))
            }
        } catch {
            alert('Erreur lors de la modification du rôle')
        } finally {
            setIsTogglingRole(false)
        }
    }

    const handleResetSubscription = async () => {
        if (!confirm(`Reinitialiser l'abonnement de ${user.name || user.email} a ${resetDays} jours ?`)) return
        setIsResettingSubscription(true)
        try {
            const result = await resetSubscription(user.id as string, resetDays)
            if (!result.success) {
                alert('Erreur: ' + (result.error || 'Impossible de reinitialiser l\'abonnement'))
            }
        } catch {
            alert('Erreur lors de la mise a jour')
        } finally {
            setIsResettingSubscription(false)
        }
    }

    const handleResetViews = async () => {
        if (!confirm(`Réinitialiser les compteurs de vues de ${user.name || user.email} ?`)) return
        setIsResettingViews(true)
        try {
            const result = await resetUserViews(user.id as string)
            if (!result.success) {
                alert('Erreur : ' + (result.error || 'Impossible de réinitialiser les vues'))
            }
        } catch {
            alert('Erreur lors de la réinitialisation des vues')
        } finally {
            setIsResettingViews(false)
        }
    }

    return (
        <>
            <TableRow
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <TableCell className="w-8">
                    {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                </TableCell>
                <TableCell className="font-medium">{(user.name as string) || "N/A"}</TableCell>
                <TableCell>{user.email as string}</TableCell>
                <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                            ? 'bg-[#F5F5F5] text-[#0F0F0F]'
                            : 'bg-slate-100 text-slate-800'
                    }`}>
                        {user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                    </span>
                </TableCell>
                <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        ['Pro','Basic'].includes(user.plan as string)
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                    }`}>
                        {getPlanDisplayName(user.plan as string)}
                    </span>
                </TableCell>
                <TableCell>
                    {user.is_beta_tester ? (
                        <span
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800"
                            title="Compte importé en masse (cohorte / bêta-testeur)"
                        >
                            Bêta
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                    )}
                </TableCell>
                <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                    }`}>
                        {user.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                </TableCell>
                <TableCell>
                    {hasSubscription ? (
                        <div className="text-xs">
                            <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span title={`Début : ${formatDateTime(subStart)}\nFin : ${formatDateTime(subEnd)}`}>
                                    {formatDateTime(subStart)} → {formatDate(subEnd)}
                                </span>
                            </div>
                            {daysLeft !== null && (
                                <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                                    daysLeft > 7
                                        ? 'bg-green-50 text-green-700'
                                        : daysLeft > 0
                                            ? 'bg-amber-50 text-amber-700'
                                            : 'bg-red-50 text-red-700'
                                }`}>
                                    <Clock className="h-3 w-3" />
                                    {hoursLeft !== null && hoursLeft <= 0
                                        ? 'Expiré'
                                        : hoursLeft !== null && hoursLeft < 24
                                            ? `${hoursLeft}h restantes`
                                            : `${daysLeft}j restants`}
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground">Aucun</span>
                    )}
                </TableCell>
                <TableCell>
                    {favoritesCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                            <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                            {favoritesCount}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                    )}
                </TableCell>
                <TableCell>
                    {formatDate(user.created_at as string)}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={openEmailDialog}
                            className="h-8 px-2"
                            title="Envoyer un email"
                        >
                            <Mail className="h-4 w-4" />
                        </Button>
                        <UserStatusToggle id={user.id as string} status={(user.status as string) || 'active'} />
                    </div>
                </TableCell>
            </TableRow>

            {/* Expanded section: payment history + subscription management */}
            {isExpanded && (
                <TableRow>
                    <TableCell colSpan={11} className="bg-muted/30 p-0">
                        <div className="px-6 py-4">
                            {/* Role management */}
                            <div className="mb-3 flex items-center gap-3 rounded-lg border bg-card p-3">
                                <span className="text-sm font-medium text-foreground mr-auto">Rôle</span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    currentRole === 'admin' ? 'bg-[#F5F5F5] text-[#0F0F0F]' : 'bg-slate-100 text-slate-800'
                                }`}>
                                    {currentRole === 'admin' ? 'Admin' : 'Utilisateur'}
                                </span>
                                <Button
                                    variant={currentRole === 'admin' ? 'destructive' : 'outline'}
                                    size="sm"
                                    onClick={handleToggleRole}
                                    disabled={isTogglingRole}
                                >
                                    {isTogglingRole ? (
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : currentRole === 'admin' ? (
                                        <ShieldOff className="mr-1 h-3 w-3" />
                                    ) : (
                                        <ShieldCheck className="mr-1 h-3 w-3" />
                                    )}
                                    {currentRole === 'admin' ? 'Retirer admin' : 'Passer admin'}
                                </Button>
                            </div>

                            {/* Subscription management */}
                            <div className="mb-4 flex items-center gap-3 rounded-lg border bg-card p-3">
                                <span className="text-sm font-medium text-foreground mr-auto">Gestion abonnement</span>

                                {isSubscriptionActive && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleEndSubscription}
                                        disabled={isEndingSubscription}
                                    >
                                        {isEndingSubscription ? (
                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        ) : (
                                            <XCircle className="mr-1 h-3 w-3" />
                                        )}
                                        Mettre fin
                                    </Button>
                                )}

                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <select
                                        value={resetDays}
                                        onChange={(e) => setResetDays(Number(e.target.value))}
                                        className="h-8 rounded-md border bg-background px-2 text-xs"
                                    >
                                        <option value={7}>7 jours</option>
                                        <option value={15}>15 jours</option>
                                        <option value={30}>30 jours</option>
                                        <option value={60}>60 jours</option>
                                        <option value={90}>90 jours</option>
                                    </select>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleResetSubscription}
                                        disabled={isResettingSubscription}
                                    >
                                        {isResettingSubscription ? (
                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        ) : (
                                            <RotateCcw className="mr-1 h-3 w-3" />
                                        )}
                                        {hasSubscription ? 'Reinitialiser' : 'Activer'}
                                    </Button>
                                </div>
                            </div>

                            {/* Reset des vues / consultations */}
                            <div
                                className="mb-4 flex items-center gap-3 rounded-lg border bg-card p-3"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <span className="text-sm font-medium text-foreground mr-auto">
                                    Compteurs de vues
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleResetViews}
                                    disabled={isResettingViews}
                                >
                                    {isResettingViews ? (
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                        <Eye className="mr-1 h-3 w-3" />
                                    )}
                                    Réinitialiser les vues
                                </Button>
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-sm">
                                    Historique des paiements
                                    {payments.length > 0 && (
                                        <span className="ml-2 text-muted-foreground font-normal">
                                            ({payments.length} transaction{payments.length > 1 ? 's' : ''})
                                        </span>
                                    )}
                                </h4>
                            </div>

                            {payments.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">
                                    Aucun paiement enregistré pour cet utilisateur.
                                </p>
                            ) : (
                                <div className="border rounded-md overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50 text-left">
                                                <th className="px-3 py-2 font-medium text-muted-foreground">Référence</th>
                                                <th className="px-3 py-2 font-medium text-muted-foreground">Description</th>
                                                <th className="px-3 py-2 font-medium text-muted-foreground">Montant</th>
                                                <th className="px-3 py-2 font-medium text-muted-foreground">Méthode</th>
                                                <th className="px-3 py-2 font-medium text-muted-foreground">Statut</th>
                                                <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payments.map((payment) => (
                                                <tr key={payment.id} className="border-t">
                                                    <td className="px-3 py-2 font-mono text-xs">
                                                        {payment.ref_command?.substring(0, 20) || '—'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {payment.item_name || 'Abonnement'}
                                                    </td>
                                                    <td className="px-3 py-2 font-semibold">
                                                        {payment.amount?.toLocaleString('fr-FR')} {payment.currency || 'XOF'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {payment.payment_method || '—'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusBadge(payment.status)}`}>
                                                            {getPaymentStatusLabel(payment.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-muted-foreground">
                                                        {formatDateTime(payment.created_at)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {payments.filter(p => p.status === 'completed').length > 0 && (
                                            <tfoot>
                                                <tr className="border-t bg-muted/30">
                                                    <td colSpan={2} className="px-3 py-2 font-medium text-right">Total payé :</td>
                                                    <td className="px-3 py-2 font-bold text-green-700" colSpan={4}>
                                                        {payments
                                                            .filter(p => p.status === 'completed')
                                                            .reduce((sum, p) => sum + (p.amount || 0), 0)
                                                            .toLocaleString('fr-FR')
                                                        } XOF
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            )}
                        </div>
                    </TableCell>
                </TableRow>
            )}

            {/* Email dialog */}
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Envoyer un email à {(user.name as string) || (user.email as string)}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="text-sm text-muted-foreground">
                            Destinataire : <span className="font-medium text-foreground">{user.email as string}</span>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email-subject">Objet</Label>
                            <Input
                                id="email-subject"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                placeholder="Objet de l'email"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email-message">Message</Label>
                            <Textarea
                                id="email-message"
                                value={emailMessage}
                                onChange={(e) => setEmailMessage(e.target.value)}
                                placeholder="Votre message..."
                                rows={8}
                                className="resize-y"
                            />
                            <p className="text-xs text-muted-foreground">
                                Les retours à la ligne seront respectés dans l{"'"}email.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handleSendEmail}
                            disabled={isSendingEmail || !emailSubject.trim() || !emailMessage.trim()}
                            className={emailSent ? 'bg-green-600 hover:bg-green-600' : ''}
                        >
                            {isSendingEmail ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Envoi...
                                </>
                            ) : emailSent ? (
                                <>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Envoyé !
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Envoyer
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
