/**
 * Script pour créer les utilisateurs admin dans Supabase
 * 
 * Usage: npx tsx --env-file=.env.local scripts/create-admins.ts
 * 
 * Prérequis: Variables d'environnement configurées dans .env.local
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (clé service_role, PAS la clé anon)
 *   - DEFAULT_ADMIN_PASSWORD
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

// Charger les variables d'environnement
const envLocalPath = resolve(process.cwd(), '.env.local')
const envPath = resolve(process.cwd(), '.env')

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath })
} else if (existsSync(envPath)) {
  config({ path: envPath })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD

if (!supabaseUrl || !serviceRoleKey || !defaultAdminPassword) {
  console.error('❌ Variables manquantes:')
  if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  if (!defaultAdminPassword) console.error('   - DEFAULT_ADMIN_PASSWORD')
  console.error('\nAssurez-vous que ces variables sont dans votre fichier .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const ADMIN_USERS = [
  {
    email: 'jeanluc@bigfiveabidjan.com',
    name: 'Jean-Luc',
    password: defaultAdminPassword,
  },
  {
    email: 'cossi@bigfiveabidjan.com',
    name: 'Cossi',
    password: defaultAdminPassword,
  },
  {
    email: 'yannick@bigfiveabidjan.com',
    name: 'Yannick J',
    password: defaultAdminPassword,
  },
  {
    email: 'franck@bigfiveabidjan.com',
    name: 'Franck',
    password: defaultAdminPassword,
  },
  {
    email: 'stephanie@bigfiveabidjan.com',
    name: 'Stéphanie',
    password: defaultAdminPassword,
  },
]

async function createAdminUser(user: { email: string; name: string; password: string }) {
  console.log(`\n📧 Création de ${user.email}...`)

  // 1. Créer l'utilisateur dans Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true, // Confirmer l'email automatiquement
    user_metadata: {
      name: user.name,
    },
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log(`   ⚠️  L'utilisateur ${user.email} existe déjà dans Auth`)
      
      // Récupérer l'ID existant
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === user.email)
      
      if (existingUser) {
        // Mettre à jour le rôle dans la table users
        const { error: updateError } = await supabase
          .from('users')
          .upsert({
            id: existingUser.id,
            email: user.email,
            name: user.name,
            role: 'admin',
            plan: 'Pro',
            status: 'active',
          }, { onConflict: 'id' })

        if (updateError) {
          console.error(`   ❌ Erreur mise à jour profil: ${updateError.message}`)
        } else {
          console.log(`   ✅ Rôle admin mis à jour pour ${user.email}`)
        }
      }
      return
    }
    console.error(`   ❌ Erreur Auth: ${authError.message}`)
    return
  }

  console.log(`   ✅ Utilisateur Auth créé (ID: ${authData.user.id})`)

  // 2. Créer le profil dans la table users
  const { error: profileError } = await supabase.from('users').upsert({
    id: authData.user.id,
    email: user.email,
    name: user.name,
    role: 'admin',
    plan: 'Pro',
    status: 'active',
  }, { onConflict: 'id' })

  if (profileError) {
    console.error(`   ❌ Erreur profil: ${profileError.message}`)
  } else {
    console.log(`   ✅ Profil admin créé dans la table users`)
  }
}

async function main() {
  console.log('🚀 Création des utilisateurs admin Big Five...')
  console.log('==========================================')

  for (const user of ADMIN_USERS) {
    await createAdminUser(user)
  }

  console.log('\n==========================================')
  console.log('✅ Terminé !')
  console.log('\n📋 Identifiants de connexion:')
  console.log('   Mot de passe par défaut: BigFive@Admin2024!')
  console.log('   ⚠️  Changez les mots de passe après la première connexion !')
}

main().catch(console.error)
