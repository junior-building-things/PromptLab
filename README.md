# PromptLab

PromptLab is a Vite + React web app for managing prompts, assets, model presets, and batch comparison runs across OpenAI and Google Gemini workflows.

## Features

- Prompt library with editable system prompts and tags
- Asset management for documents, images, and raw text context
- Model preset management for OpenAI and Gemini endpoints
- Batch testing workspace with mocked run execution and persisted history
- History view modeled on the Figma Make prototype
- Local persistence via `localStorage`

## Local development

```bash
npm install
npm run dev
```

## Provider execution

Batch tests post to `/api/batch-run`, a Vercel serverless function that fans out requests to OpenAI Responses or Gemini Generate Content using the selected model presets.

Expected env vars:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

Optional frontend env vars for local experiments:

- `VITE_OPENAI_API_KEY`
- `VITE_GEMINI_API_KEY`
