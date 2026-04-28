-- Google Calendar / Workspace integration metadata

alter table public.user_integrations
  add column if not exists account_email text;

alter table public.profiles
  add column if not exists default_google_calendar_id text;

comment on column public.user_integrations.account_email is 'Google account email from userinfo (not secret); shown in Settings.';
comment on column public.profiles.default_google_calendar_id is 'Preferred Google calendar id for agent tools; null means use primary.';
