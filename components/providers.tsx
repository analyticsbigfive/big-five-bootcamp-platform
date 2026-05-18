
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { SubscriptionStatusBottomSheet } from "@/components/subscription-status-bottom-sheet"
import { EmailVerificationBottomSheet } from "@/components/email-verification-bottom-sheet"
import { Toaster } from "sonner"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        {children}
        <SubscriptionStatusBottomSheet />
        <EmailVerificationBottomSheet />
      </AuthProvider>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  )
}
