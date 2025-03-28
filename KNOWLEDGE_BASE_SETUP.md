# Knowledge Base Setup for MusTax AI

This guide explains how to set up and use the Pinecone knowledge base with your MusTax AI chatbot.

## Prerequisites

1. A Pinecone account (sign up at [pinecone.io](https://www.pinecone.io/))
2. Your Pinecone API key
3. Node.js and pnpm installed

## Setup Instructions

### 1. Configure Environment Variables

Add your Pinecone API key to the `.env.local` file:

```
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=knowledge-base
```

Replace `your_pinecone_api_key_here` with your actual Pinecone API key.

### 2. Prepare Your Documents

Place your UAE Corporate Tax documents in the `docs` directory. The following file types are supported:
- Text files (.txt)
- PDF files (.pdf) - text content only
- Markdown files (.md)

A sample document has been provided at `docs/uae-corporate-tax-sample.txt` for testing purposes.

### 3. Upload Documents to Pinecone

Run the following command to process and upload your documents to Pinecone:

```bash
pnpm run upload-kb
```

This script will:
1. Create a Pinecone index if it doesn't exist
2. Process each document in the `docs` directory
3. Split documents into smaller chunks
4. Generate embeddings for each chunk
5. Upload the embeddings to Pinecone

### 4. Test the Knowledge Base

Once your documents are uploaded, you can test the knowledge base by asking questions about UAE Corporate Tax in the chat interface. The AI will automatically query the knowledge base when appropriate.

Example questions to try:
- "What is the standard corporate tax rate in the UAE?"
- "Who is exempt from UAE corporate tax?"
- "How do free zone companies get taxed in the UAE?"
- "What are the compliance requirements for UAE corporate tax?"

## How It Works

1. When you ask a question, the AI evaluates whether it should use the knowledge base
2. If appropriate, it formulates a query to search the knowledge base
3. The query is converted into an embedding (a numerical representation of the text)
4. Pinecone searches for similar embeddings in the knowledge base
5. The most relevant information is returned to the AI
6. The AI incorporates this information into its response

## Troubleshooting

If you encounter issues:

1. Check that your Pinecone API key is correctly set in `.env.local`
2. Ensure your Pinecone service is active and has available capacity
3. For large documents, consider splitting them manually into smaller files
4. Check the console output for specific error messages

## Customization

You can customize the knowledge base behavior by modifying:

- `lib/pinecone/index.ts` - Core Pinecone integration
- `lib/ai/tools/query-knowledge-base.ts` - Knowledge base query tool
- `scripts/upload-to-knowledge-base.ts` - Document processing and upload

## Limitations

- The current implementation only supports text-based documents
- For PDFs, only the text content is extracted (images and formatting are ignored)
- Very large documents may need to be split manually
- The quality of responses depends on the quality and relevance of the documents in the knowledge base 