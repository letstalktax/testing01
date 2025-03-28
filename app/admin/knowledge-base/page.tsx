import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { AdminKnowledgeBaseManager } from '@/components/admin/knowledge-base-manager';

// Check if user is an admin
async function isAdmin(userId: string) {
  const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || [];
  return adminUsers.includes(userId);
}

export default async function AdminKnowledgeBasePage() {
  const session = await auth();
  
  // Redirect if not logged in or not an admin
  if (!session || !session.user || !session.user.id || !await isAdmin(session.user.id)) {
    redirect('/');
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Knowledge Base Management</h1>
      <AdminKnowledgeBaseManager />
    </div>
  );
} 