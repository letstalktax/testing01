import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="max-w-5xl w-full">
        <h1 className="text-3xl font-bold mb-8 text-center">UAE Corporate Tax Analysis</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Financial Documents</CardTitle>
              <CardDescription>
                Analyze your financial statements and get tailored tax insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Upload your financial statements to receive a detailed corporate tax analysis report with 
                recommendations tailored to your business.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/analyze" className="w-full">
                <Button className="w-full">Upload Documents</Button>
              </Link>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Tax Knowledge Base</CardTitle>
              <CardDescription>
                Access comprehensive UAE corporate tax information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-4">
                  <h3 className="font-medium">UAE Corporate Tax Knowledge Base</h3>
                  <p>
                    Our knowledge base contains detailed information about:
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Corporate Tax applicability and rates</li>
                    <li>Small Business Relief eligibility</li>
                    <li>Qualifying income exemptions</li>
                    <li>Tax group requirements</li>
                    <li>Transfer pricing considerations</li>
                    <li>Tax loss treatment and limitations</li>
                  </ul>
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <Link href="/test-kb" className="w-full">
                <Button variant="outline" className="w-full">Browse Knowledge Base</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
        
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Your Previous Reports</CardTitle>
              <CardDescription>
                Access your previously generated tax analysis reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-4">
                Sign in to view your previous tax analysis reports
              </p>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Link href="/api/auth/signin">
                <Button variant="secondary">Sign In</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
} 