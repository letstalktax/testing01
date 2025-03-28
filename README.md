<a href="https://chat.vercel.ai/">
  <img alt="Next.js 14 and App Router-ready AI chatbot." src="app/(chat)/opengraph-image.png">
  <h1 align="center">MusTax AI - UAE Corporate Tax Chatbot</h1>
</a>

<p align="center">
  A specialized AI chatbot for UAE Corporate Tax guidance and assistance.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#tax-expertise"><strong>Tax Expertise</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- **UAE Corporate Tax Expertise**
  - Comprehensive guidance on UAE Corporate Tax regulations
  - Tax planning and compliance assistance
  - Up-to-date information on tax laws and requirements
  
- **Advanced AI Models**
  - MusTax Basic: Quick answers for basic UAE Corporate Tax questions
  - MusTax Professional: Detailed guidance for complex UAE Corporate Tax scenarios
  - MusTax Expert: Advanced tax planning and regulatory compliance analysis

- **Modern Technology Stack**
  - [Next.js](https://nextjs.org) App Router for seamless navigation
  - [AI SDK](https://sdk.vercel.ai/docs) for powerful AI capabilities
  - [shadcn/ui](https://ui.shadcn.com) with [Tailwind CSS](https://tailwindcss.com) for a beautiful interface
  - Secure authentication with [NextAuth.js](https://github.com/nextauthjs/next-auth)

- **Document Management**
  - Create and save tax documents and calculations
  - Generate tax forms and templates
  - Secure storage of tax-related information

## Tax Expertise

MusTax AI provides expert guidance on:

- UAE Corporate Tax registration and compliance
- Tax calculations and planning
- Deductible expenses and exemptions
- Free Zone tax considerations
- Transfer pricing requirements
- Tax filing procedures and deadlines
- Small business relief eligibility

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run MusTax AI. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various OpenAI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm dev
```

Your MusTax AI application should now be running on [localhost:3000](http://localhost:3000/).

# MusTax AI Chatbot

A powerful AI chatbot for tax-related queries with document processing capabilities.

## Features

- Chat with AI about tax-related questions
- Upload and process documents (PDF, DOCX, TXT)
- Multimodal document analysis with Llama 3.2 Vision
- Structured JSON processing of document content
- RAG (Retrieval-Augmented Generation) for accurate responses
- Knowledge base management

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- OpenAI API key
- Pinecone account and API key
- OpenRouter API key (for Llama 3.2 Vision)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy the example environment file and fill in your API keys:
   ```bash
   cp .env.local.example .env.local
   ```
4. Start the development server:
   ```bash
   pnpm dev
   ```

## Document Processing with Llama 3.2 Vision

This application uses Llama 3.2 Vision via OpenRouter to analyze and extract text from documents. The extracted text is then processed into structured JSON format for better context retrieval.

### How it Works

1. Upload a document through the UI
2. The document is sent to the `/api/vision` endpoint
3. The endpoint uses OpenRouter to call Llama 3.2 Vision model
4. The model extracts text from the document
5. The extracted text is converted to structured JSON with sections
6. Each section is processed as a separate chunk for better context retrieval
7. JSON chunks are embedded and stored in Pinecone
8. When querying, the system intelligently formats JSON sections for the AI

### Structured JSON Processing

The system processes documents into a structured JSON format that:

- Identifies and separates document sections
- Preserves document structure and hierarchy
- Enables more precise context retrieval
- Improves the quality of AI responses by providing better context

### Supported File Types

- PDF files
- DOCX files
- Text files
- Markdown files

### Configuration

To use Llama 3.2 Vision, you need to:

1. Get an API key from [OpenRouter](https://openrouter.ai)
2. Add the key to your `.env.local` file:
   ```
   OPENROUTER_API_KEY=your-openrouter-api-key
   ```

## Knowledge Base Management

You can upload documents to build your knowledge base:

1. Go to the Document Upload page
2. Upload your tax-related documents
3. The system will process them and make them available for the chatbot

## Development

### Project Structure

- `/app` - Next.js app router pages and API routes
- `/components` - React components
- `/lib` - Utility functions and libraries
- `/public` - Static assets

### API Routes

- `/api/chat` - Main chat endpoint
- `/api/vision` - Document processing with Llama 3.2 Vision
- `/api/files/upload` - File upload endpoint
- `/api/documents` - Document management endpoint

## License

MIT
