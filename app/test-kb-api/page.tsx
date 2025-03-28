'use client';

import { useState } from 'react';

export default function TestKnowledgeBaseAPI() {
  const [query, setQuery] = useState('What is the standard corporate tax rate in the UAE?');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, topK: 3 }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Knowledge Base API</h1>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label htmlFor="query" className="block mb-2">Query:</label>
          <input
            type="text"
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        
        <button 
          type="submit" 
          className="px-4 py-2 bg-blue-500 text-white rounded"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {results.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold mb-2">Results:</h2>
          {results.map((result, index) => (
            <div key={index} className="mb-4 p-4 border border-gray-200 rounded">
              <p><strong>ID:</strong> {result.id}</p>
              <p><strong>Score:</strong> {result.score}</p>
              {result.metadata && (
                <>
                  <p><strong>Source:</strong> {result.metadata.source || 'N/A'}</p>
                  <div>
                    <strong>Text:</strong>
                    <p className="mt-1 whitespace-pre-wrap">
                      {typeof result.metadata.text === 'string' 
                        ? result.metadata.text 
                        : String(result.metadata.text || 'N/A')}
                    </p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        !loading && <p>No results found.</p>
      )}
    </div>
  );
} 