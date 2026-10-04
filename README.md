<div align="center">
  <h1>🎓 Student Club Platform</h1>
  <p><em>The ultimate, self-hosted platform to manage student organizations, built for the Odoo Hackathon.</em></p>

  [![React](https://img.shields.io/badge/React-18-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-20-green.svg?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248.svg?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
  [![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
</div>

---

## 🚀 Overview

Student clubs need a lightweight, self-hosted platform to manage memberships, collect dues, run events with limited tickets, communicate with members, sell merchandise, coordinate volunteers, and report on finances — all in one place, without paying for a commercial solution. 

This platform solves this by providing a unified, beautifully designed hub. It operates entirely independently and does **not** run inside Odoo.

## ✨ Key Features

- **🛡️ Comprehensive Access Control:** Distinct, secure experiences for Members, Volunteers (Officers), Treasurers, and Admins.
- **💳 Memberships & Dues:** Tier management, payment recording, and automated status badges.
- **📅 Events & Ticketing:** Create and publish events, manage capacities, and handle atomic reservations for tickets.
- **📣 Announcements:** Pin important updates and notify members with unread hints.
- **🛒 Merchandise Store:** Browse the club catalog, manage size variants, and place atomic orders.
- **🤝 Volunteer Task Board:** A live, Kanban-style board for coordinating club projects and tasks.
- **📊 Treasurer & Financial Reports:** Complete ledger for submitting, reviewing, and reimbursing expenses.
- **💬 Support System:** Built-in ticketing system for members to communicate with administrators.

## 🛠️ Tech Stack

| Layer                | Technology                                               |
| -------------------- | -------------------------------------------------------- |
| **Frontend**         | React 18 + TypeScript (Vite)                             |
| **Styling**          | Modern, Token-based Vanilla CSS (Glassmorphism & Gradients) |
| **API**              | Node.js + Express + TypeScript                           |
| **Database**         | MongoDB (Replica Set for strict atomic transactions)     |
| **Cache/Ephemeral**  | Redis (Rate limiting & sessions)                         |
| **Infrastructure**   | Docker & Docker Compose                                  |

> **Design Philosophy:** The platform embraces rich aesthetics—featuring curated color palettes, modern typography, glassmorphism, and micro-animations to deliver a premium, state-of-the-art user experience.

---

## 🚦 Quick Start (Local Development)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Node.js ≥ 20 (for local package management)

### Setup Instructions

1. **Clone & Configure**
   ```bash
   git clone <repo-url>
   cd odoo-student-club
   cp .env.example .env
   ```
   *Note: Edit `.env` to set a secure `JWT_SECRET`.*

2. **Launch Services**
   ```bash
   docker compose up -d
   ```
   *(This starts MongoDB, Redis, the Node API, and the React client).*

3. **Seed Database**
   ```bash
   # Seeds the database with rich test data (Events, Announcements, Merchandise, etc.)
   docker compose exec server npx tsx apps/server/src/scripts/seed-more.ts
   ```

4. **Verify Health & Access**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Open **[http://localhost:5173](http://localhost:5173)** in your browser to view the platform!

---

## 🏗️ Repository Architecture

```text
odoo-student-club/
├── AGENTS.md                  ← Coding-agent rules
├── apps/
│   ├── client/                ← React + TypeScript frontend (Vite)
│   └── server/                ← Node + Express backend API
├── docker-compose.yml         ← Container orchestration
├── docs/                      ← Architecture and Data Model documentation
└── package.json               ← NPM Workspaces root
```

## 📝 Agent Instructions & Guidelines

Every developer or AI agent contributing to this repository **must** read [`AGENTS.md`](./AGENTS.md) before making changes. It enforces strict rules on:
- Naming conventions & formatting
- TypeScript strict mode
- Error handling & Secrets management
- MongoDB query safety and atomic transactions

## 👤 Author
Created by **Dharmik Suchak** for the Odoo Hackathon.
