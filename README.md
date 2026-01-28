# ShotFlow — VFX Pipeline Manager

Professional shot tracking and pipeline management for film & episodic VFX production.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **UI:** Tailwind CSS + shadcn/ui + Radix primitives
- **Deploy:** Vercel

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase project URL and keys

# Run database migrations in Supabase Dashboard SQL editor:
# 1. supabase/migrations/00001_initial_schema.sql
# 2. supabase/migrations/00002_seed_data.sql

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Note:** The app works with mock data out of the box — no Supabase connection required for UI development. Connect Supabase for persistent data.

## Features

- **Dashboard** — Project overview with shot status breakdown and activity feed
- **Projects** — Create and manage VFX projects
- **Shots Board** — Kanban + table view with filters (sequence, assignee, status, complexity)
- **Shot Detail** — Version history, notes per version, status controls, assignment
- **Turnover Import** — Upload EDL files, preview parsed shots, import to project
- **Delivery Tracker** — Track shot delivery status and client acceptance
- **Client Portal** — Filtered view for client review and approval workflow
- **User Management** — Invite users, assign roles (Admin, Supervisor, Artist, Client)

## Database

Schema is defined in `supabase/migrations/`. Run these SQL files in your Supabase project's SQL editor or via the Supabase CLI:

```bash
supabase db push
```

## Project Structure

```
src/
├── app/
│   ├── (app)/              # App pages with sidebar layout
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── shots/[id]/
│   │   ├── turnover/
│   │   ├── deliveries/
│   │   ├── client/
│   │   └── users/
│   └── api/                # API routes (future)
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── sidebar.tsx
│   ├── header.tsx
│   └── status-badge.tsx
└── lib/
    ├── supabase.ts         # Supabase client
    ├── database.types.ts   # TypeScript types for DB
    ├── utils.ts
    ├── mock-data.ts
    └── edl-parser.ts
supabase/
└── migrations/             # SQL migrations
```
