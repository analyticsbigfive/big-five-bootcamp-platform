'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

const TURNSTILE_SITE_KEY = TURNSTILE_SITE_KEY

export default function AuthPage() {
  const router = useRouter()
  const { signIn, signUp, loading } = useSupabaseAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (isSignUp) {
        const siteKey = TURNSTILE_SITE_KEY
        if (siteKey && !turnstileToken) {
          toast.error("Veuillez compléter la vérification de sécurité")
          setIsSubmitting(false)
          return
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            turnstileToken: turnstileToken ?? undefined,
          }),
        })
        const json = await res.json()
        turnstileRef.current?.reset()
        setTurnstileToken(null)
        if (!res.ok) throw new Error(json.error || "Erreur lors de la création du compte")
        toast.success('Compte créé avec succès! Vérifiez votre email pour confirmer votre compte.')
        router.push('/dashboard')
      } else {
        const { data, error } = await signIn(formData.email, formData.password)
        if (error) throw error
        toast.success('Connexion réussie!')
        router.push('/dashboard')
      }
    } catch (error: any) {
      const msg = error.message || ''
      if (msg === 'Invalid login credentials') {
        toast.error('Compte introuvable', {
          description: "Aucun compte n'est associé à cet email ou le mot de passe est incorrect.",
        })
      } else if (msg === 'Email not confirmed') {
        toast.warning('Email non vérifié', {
          description: 'Veuillez vérifier votre boîte mail pour confirmer votre compte.',
        })
      } else if (msg.includes('User already registered')) {
        toast.error('Email déjà utilisé', {
          description: 'Un compte existe déjà avec cet email. Essayez de vous connecter.',
        })
      } else {
        toast.error(msg || 'Une erreur est survenue')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0F0F0F]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5F5F5] to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isSignUp ? 'Créer un compte' : 'Se connecter'}
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUp
              ? 'Créez votre compte Laveiye'
              : 'Connectez-vous à votre compte Laveiye'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required={isSignUp}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
              {isSignUp && (
                <p className="text-xs text-muted-foreground">
                  Minimum 6 caractères
                </p>
              )}
            </div>
            {isSignUp && TURNSTILE_SITE_KEY && (
              <div className="flex justify-center pt-2">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={setTurnstileToken}
                  onExpire={() => setTurnstileToken(null)}
                  onError={() => setTurnstileToken(null)}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit" 
              className="w-full bg-[#F2B33D] text-black hover:bg-[#F2B33D]/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  {isSignUp ? 'Création...' : 'Connexion...'}
                </span>
              ) : (
                isSignUp ? 'Créer mon compte' : 'Se connecter'
              )}
            </Button>
            
            <div className="text-center text-sm">
              {isSignUp ? (
                <p>
                  Vous avez déjà un compte?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className="text-[#0F0F0F] hover:underline font-medium"
                  >
                    Se connecter
                  </button>
                </p>
              ) : (
                <p>
                  Vous n'avez pas de compte?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className="text-[#0F0F0F] hover:underline font-medium"
                  >
                    Créer un compte
                  </button>
                </p>
              )}
            </div>

            {!isSignUp && (
              <Link 
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-[#0F0F0F] text-center"
              >
                Mot de passe oublié?
              </Link>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
