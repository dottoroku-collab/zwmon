# Sistem Tiketing & SLA Control Telkom Makassar - PRD

## Problem Statement
Sistem untuk pelaporan, penanganan gangguan lapangan, dan monitoring SLA/SLG untuk PT Telkom Makassar dan Dinas Kominfo. Mengelola 3 layanan: Jaringan CCTV, Internet Dedicated SKPD, dan Internet IP Speaker.

## Tech Stack
- **Frontend**: React.js, Tailwind CSS, Recharts, Lucide-React, Shadcn/UI
- **Backend**: FastAPI, Python, WebSockets, APScheduler, ReportLab
- **Database**: MongoDB
- **Auth**: JWT (JSON Web Tokens)

## Core Requirements
- Authentication & RBAC (Admin, AM, Helpdesk, EOS, Client)
- Ticketing lifecycle (Create → Assign → EOS Work → AM Verify/Reject → Close)
- Digital Logbook (multi-step, photo evidence)
- Restitution Calculator & Reports
- Dashboard with charts
- Network Monitoring (auto ping, per-category view)
- Internal Chat, Profile, Settings
- PDF Reports
- Light/Dark theme toggle
- WebSocket real-time updates

## What's Been Implemented (All Complete)
- [x] JWT Auth with RBAC (5 roles)
- [x] Complete ticketing workflow with AM verification/rejection
- [x] Digital Logbook (multi-step, service-type specific)
- [x] Restitution Calculator & Report page
- [x] Dashboard with Recharts visualizations
- [x] Network Monitoring - separated by category (SKPD, CCTV, IP Speaker)
- [x] Internal Chat (role-restricted)
- [x] User Profile & Password Change
- [x] Admin Settings (site logo, site name)
- [x] Light/Dark theme toggle with comprehensive CSS overrides
- [x] PDF report generation
- [x] WebSocket real-time updates
- [x] SLA Compliance page
- [x] Service Points management
- [x] User Management (admin only)
- [x] Notification system

## Latest Changes (Feb 27, 2026)
- Monitoring page: service points separated per category (Internet SKPD, CCTV, IP Speaker)
- Theme fix: dark mode = white font, light mode = black font (comprehensive CSS overrides)
- Toast notifications now theme-aware

## Credentials
- Admin: admin@telkom.co.id / admin123
- AM: am@telkom.co.id / am1234
- Helpdesk: helpdesk@telkom.co.id / helpdesk123
- EOS: eos@telkom.co.id / eos1234
- Client: client@skpd.go.id / client123
