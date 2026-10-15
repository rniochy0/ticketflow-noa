import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <PageContainer $size="sm">
      <EmptyState
        title="Página não encontrada"
        description="O endereço não existe ou já não está disponível."
        action={
          <Link href="/">
            <Button>Ir para o início</Button>
          </Link>
        }
      />
    </PageContainer>
  );
}