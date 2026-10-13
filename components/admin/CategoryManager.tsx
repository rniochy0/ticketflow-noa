"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import { InlineNameForm } from "./InlineNameForm";
import { ActiveToggleButton } from "./ActiveToggleButton";
import {
  createCategory,
  renameCategory,
  createSubcategory,
  renameSubcategory,
  toggleCategoryActive,
  toggleSubcategoryActive,
} from "@/app/admin/categories/actions";

export type SubRow = { id: string; name: string; is_active: boolean };
export type CategoryRow = { id: string; name: string; is_active: boolean; subs: SubRow[] };

function NameWithRename({
  name,
  inactive,
  renameAction,
  id,
}: {
  name: string;
  inactive: boolean;
  renameAction: typeof renameCategory;
  id: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <InlineNameForm
        action={renameAction}
        label="Novo nome"
        submitLabel="Guardar"
        hidden={{ id }}
        initialName={name}
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <Inline $gap="sm">
      <strong>{name}</strong>
      {inactive && <MutedText>(inactiva)</MutedText>}
      <Button type="button" $variant="secondary" onClick={() => setEditing(true)}>
        Renomear
      </Button>
    </Inline>
  );
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  return (
    <Stack $gap="md">
      <Card>
        <InlineNameForm action={createCategory} label="Nova categoria" submitLabel="Adicionar" />
      </Card>

      {categories.length === 0 && (
        <EmptyState title="Ainda não há categorias" description="Adiciona a primeira acima." />
      )}

      {categories.map((c) => (
        <Card key={c.id}>
          <Stack $gap="md">
            <Inline $gap="md">
              <NameWithRename
                id={c.id}
                name={c.name}
                inactive={!c.is_active}
                renameAction={renameCategory}
              />
              <ActiveToggleButton
                isActive={c.is_active}
                onToggle={(next) => toggleCategoryActive(c.id, next)}
              />
            </Inline>

            <Stack $gap="sm">
              {c.subs.length === 0 && <MutedText>Sem subcategorias.</MutedText>}
              {c.subs.map((s) => (
                <Inline key={s.id} $gap="md">
                  <NameWithRename
                    id={s.id}
                    name={s.name}
                    inactive={!s.is_active}
                    renameAction={renameSubcategory}
                  />
                  <ActiveToggleButton
                    isActive={s.is_active}
                    onToggle={(next) => toggleSubcategoryActive(s.id, next)}
                  />
                </Inline>
              ))}
            </Stack>

            <InlineNameForm
              action={createSubcategory}
              label="Nova subcategoria"
              submitLabel="Adicionar"
              hidden={{ categoryId: c.id }}
            />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}