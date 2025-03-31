'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { AuthForm } from '@/components/auth-form';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';
import { LogoMusTax } from '@/components/icons';
import { useAuth } from '@/lib/firebase/auth-context';

export default function Page() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    try {
      setIsLoading(true);
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      
      await signUp(email, password);
      setEmail(email);
      toast({
        type: 'success',
        description: 'Account created successfully!',
      });
      router.refresh();
      router.push('/');
    } catch (error: any) {
      toast({
        type: 'error',
        description: error.message || 'Failed to create account!',
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
            Create an account
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email below to create your account
          </p>
        </div>
        <AuthForm
          type="register"
          onSubmit={handleSubmit}
          isLoading={isLoading}
          defaultEmail={email}
        />
        <p className="px-8 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="hover:text-brand underline underline-offset-4"
          >
            Already have an account? Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
