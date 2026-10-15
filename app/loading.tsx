import { PageContainer } from "@/components/layout/PageContainer";
import { Stack } from "@/components/layout/Stack";
import { Skeleton } from "@/components/ui/Skeleton";
// Mostrado enquanto qualquer página do servidor carrega os dados
export default function Loading() {
  return (
    <PageContainer $size="lg" aria-busy="true" aria-label="A carregar">
      <Skeleton $h={28} style={{ width: "40%" }} />
      <Stack $gap="md">
        <Skeleton $h={72} />
        <Skeleton $h={72} />
        <Skeleton $h={72} />
      </Stack>
    </PageContainer>
  );
}
