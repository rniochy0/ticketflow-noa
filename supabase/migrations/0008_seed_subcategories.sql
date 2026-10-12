-- Subcategorias iniciais (provisórias): o admin ajusta em /admin/categories.
-- Idempotente: pode correr mais de uma vez sem duplicar.
insert into public.subcategories (category_id, name)
select c.id, v.sub
from (values
  ('Computador',   'Não liga'),
  ('Computador',   'Lento / bloqueia'),
  ('Computador',   'Software / instalação'),
  ('Impressora',   'Não imprime'),
  ('Impressora',   'Toner / papel'),
  ('Impressora',   'Digitalizar / scanner'),
  ('Rede',         'Sem internet'),
  ('Rede',         'Wi-Fi'),
  ('Rede',         'VPN'),
  ('Email',        'Não recebe / não envia'),
  ('Email',        'Criar / repor conta'),
  ('Acessos',      'Repor password'),
  ('Acessos',      'Pedir permissões'),
  ('Sistemas',     'WINOPT'),
  ('Sistemas',     'Outro sistema'),
  ('Equipamentos', 'Monitor / teclado / rato'),
  ('Equipamentos', 'Telefone / outro equipamento')
) as v(cat, sub)
join public.categories c on c.name = v.cat
on conflict (category_id, name) do nothing;