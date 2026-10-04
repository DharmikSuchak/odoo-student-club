<div align="center">
  <h1>Student Club Platform</h1>
  <p><em>The ultimate, self-hosted platform to manage student organizations, built for the Odoo Hackathon.</em></p>

  **[Video of project (summary in 7min)](https://youtube.com/watch?v=nUCQ-F1Mpec&feature=youtu.be)**

  <br />

  [![React](https://img.shields.io/badge/React-18-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-20-green.svg?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248.svg?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
  [![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
</div>

---

## Overview

Student clubs need a lightweight, self-hosted platform to manage memberships, collect dues, run events with limited tickets, communicate with members, sell merchandise, coordinate volunteers, and report on finances — all in one place, without paying for a commercial solution. 

This platform solves this by providing a unified, beautifully designed hub. It operates entirely independently and does **not** run inside Odoo.

## Comprehensive Feature Set

### 1. Advanced Role-Based Access Control (RBAC)
A highly secure, deeply integrated permissions system that curates the entire UI and API experience based on four distinct roles:
- **Member:** Can browse events, purchase merchandise, view announcements, submit expenses, and open support tickets.
- **Officer (Volunteer):** Gains access to the Volunteer Task Board to manage club projects and tasks, alongside standard member features.
- **Treasurer:** Specialized access to financial tools, including the comprehensive Treasurer Report, Expense Review, and Merchandise Product management.
- **Admin:** Full administrative oversight. The only role with access to Manage Memberships, oversee the entire user base, and reply directly to Support Tickets.

### 2. Membership & Dues Management
- Automated tracking of membership status (Active, Pending Payment, Lapsed).
- Integrated dashboard indicating payment status.
- Admin portal to review, manage, and override membership states.

### 3. Events & Ticketing System
- **Event Creation:** Organizers can create detailed events with locations, descriptions, and dynamic dates.
- **Tiered Pricing:** Distinct ticket pricing for members vs. non-members.
- **Atomic Capacity Management:** Strict database-level transactions ensure that tickets can never be over-booked, even under high traffic.
- **Check-in System:** Built-in tools for officers to check in attendees on the day of the event.

### 4. Merchandise Store & Inventory
- **Variant Management:** Products support multiple size variants (e.g., S, M, L, XL), each with independent stock tracking.
- **Atomic Stock Deductions:** Race-condition-free ordering system ensures inventory is accurately updated.
- **Club Catalog:** Beautiful storefront for members to browse and purchase official club gear.

### 5. Treasurer & Financial Ledgers
- **Expense Submission:** Any member can submit receipts and expense claims.
- **Multi-step Approval Flow:** Expenses are first reviewed by an Admin, then formally reimbursed by a Treasurer.
- **Automated Ledger:** A real-time Treasurer Report dynamically calculates net revenue from dues, merchandise, and event tickets, minus reimbursed expenses.

### 6. Volunteer Task Board
- **Kanban-Style Organization:** Visual board grouping tasks into To-Do, In Progress, and Completed.
- **Self-Assignment:** Volunteers can claim tasks and track their contributions to the club.

### 7. Announcements & Communication
- Global bulletin board for club updates.
- Support for pinned posts and unread indicators to ensure critical information is never missed.

### 8. Integrated Help Desk (Support Tickets)
- Dedicated portal for members to submit queries, feedback, or issues.
- Admin-exclusive dashboard to track, manage, and reply to all open tickets in a centralized thread.

## Future Scope

While the platform is robust and feature-rich, the following enhancements are planned for future iterations:
- **Personalized Email Notifications:** Automated, personalized email dispatches to members for critical announcements and events.
- **Enhanced Support & AI Chatbot:** An upgraded ticketing system featuring AI-driven chatbot support for instant query resolution and a dynamic FAQ section for onboarding new members.
- **Real-Time In-App Chat:** A live websocket-based chat interface allowing real-time communication between all roles (Members, Officers, Treasurers, and Admins) directly within the web app.

## Tech Stack & Architecture

| Layer                | Technology                                               |
| -------------------- | -------------------------------------------------------- |
| **Frontend**         | React 18 + TypeScript (Vite)                             |
| **Styling**          | Modern, Token-based Vanilla CSS                            |
| **API**              | Node.js + Express + TypeScript                           |
| **Database**         | MongoDB (Replica Set for strict atomic transactions)     |
| **Cache/Ephemeral**  | Redis (Rate limiting & sessions)                         |
| **Infrastructure**   | Docker & Docker Compose                                  |

> **Design Philosophy:** The platform embraces rich aesthetics—featuring curated HSL color palettes, modern typography, glassmorphism, and micro-animations to deliver a premium, state-of-the-art user experience. 

---

## Quick Start (Local Development)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Node.js >= 20 (for local package management)

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

## Repository Architecture

```text
odoo-student-club/
├── apps/
│   ├── client/                <- React + TypeScript frontend (Vite)
│   └── server/                <- Node + Express backend API
├── docker-compose.yml         <- Container orchestration
├── docs/                      <- Architecture and Data Model documentation
└── package.json               <- NPM Workspaces root
```

## Author
Created by **Dharmik Suchak** for the Odoo Hackathon.
