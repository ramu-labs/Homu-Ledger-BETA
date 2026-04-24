-- Add icon_style preference to profiles
-- "2d" = Lucide 2D icons, "3d" = 3D emoji (default)
alter table public.profiles
  add column if not exists icon_style text not null default '3d'
  check (icon_style in ('2d', '3d'));
