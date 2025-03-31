'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { AuthForm } from '@/components/auth-form';
import { SubmitButton } from '@/components/submit-button';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';
import { LogoMusTax } from '@/components/icons';
import { useAuth } from '@/lib/firebase/auth-context';

export default function Page() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    try {
      setIsLoading(true);
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      
      await signIn(email, password);
      setEmail(email);
      router.refresh();
      router.push('/');
    } catch (error: any) {
      toast({
        type: 'error',
        description: error.message || 'Failed to sign in!',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container relative flex h-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <LogoMusTax className="mx-auto h-6 w-6" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to {APP_NAME}
          </h1>
          <p className="text-sm text-muted-foreground">
            {APP_DESCRIPTION}
          </p>
        </div>
        <AuthForm
          type="login"
          onSubmit={handleSubmit}
          isLoading={isLoading}
          defaultEmail={email}
        />
        <p className="px-8 text-center text-sm text-muted-foreground">
          <Link
            href="/register"
            className="hover:text-brand underline underline-offset-4"
          >
            Don&apos;t have an account? Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
