# CareSync AI — Senior-First Elderly Care & Medication Management Platform

Built for the **Catalyst | Solo AI Hackathon (PromptWars x Makers Need More)**.

🔗 **Live Prototype:** https://fabulous-scone-a3402b.netlify.app

## Overview
CareSync AI bridges the gap between elder independence and family peace of mind. Rather than treating older adults as passive recipients of alerts, CareSync AI puts the senior in control of their care plan while keeping their Care Circle informed automatically.

## Key Features
- **Elder Stays in Control (Pending Approval Workflow):** New medications or appointments added by family members or caregivers remain `Pending` until explicitly reviewed and approved by the senior.
- **Senior-First Accessible UI:** High-contrast dark mode, large typography, oversized touch targets, and zero screen clutter.
- **Built-In Voice Readouts:** Uses the browser Web Speech API (Text-to-Speech) to read medication schedules and instructions aloud.
- **Missed-Dose Escalation:** Automatically notifies the Care Circle if a scheduled dose goes unconfirmed past its window, eliminating intrusive constant check-ins.
- **Passcode-Protected Care Circle Portal:** Role-separated views for seniors, family members, and caregivers.

## Tech Stack
- **Frontend:** HTML5, CSS3 (Responsive High-Contrast UI), Vanilla JavaScript
- **Accessibility & Speech:** Web Speech API (`speechSynthesis`)
- **Deployment:** Netlify
