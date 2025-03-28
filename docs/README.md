# Knowledge Base Documents

This directory is used to store documents that will be uploaded to the Pinecone knowledge base for your AI chatbot.

## How to Use

1. Place your UAE Corporate Tax documents (text files, PDFs, etc.) in this directory.
2. Run the upload script to process and upload the documents to Pinecone:

```bash
pnpm run upload-kb
```

## Document Guidelines

- Text files (.txt) are preferred for optimal processing
- For PDFs, consider extracting the text first for better results
- Each document should contain relevant UAE Corporate Tax information
- Organize your documents by topic for better search results
- Larger documents will be automatically chunked into smaller pieces

## Supported File Types

Currently, the upload script supports:
- Text files (.txt)
- PDF files (.pdf) - text content only
- Markdown files (.md)

## Troubleshooting

If you encounter issues with the upload process:

1. Check that your Pinecone API key is correctly set in `.env.local`
2. Ensure your Pinecone service is active and has available capacity
3. For large documents, consider splitting them manually into smaller files
4. Check the console output for specific error messages 