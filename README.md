NOA HelpDesk

Sistema de helpdesk interno para a NOA Óticas — permite a qualquer colaborador abrir, acompanhar e responder a pedidos de suporte, enquanto a equipa de IT gere, atribui e resolve esses pedidos.

# Stack
Next.js (App Router) + TypeScript
Styled Components
Supabase (Postgres, Auth, Storage, Realtime)
Deploy: Vercel

# Funcionalidades
Autenticação e perfis de utilizador (RBAC: colaborador, técnico, gestor, admin)
Criação e acompanhamento de tickets, com categorias, anexos e prioridade
Chat/mensagens em tempo real por ticket
Histórico de eventos por ticket
Dashboards com indicadores (KPIs) para IT e gestão
Notificações por email
Gestão administrativa de lojas, categorias e técnicos

# Getting Started
bash
## Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Ambiente de desenvolvimento
npm run dev
Variáveis de ambiente
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
Licença

Este projeto é de uso interno da NOA Óticas.