import { PageTitle } from "@/components/app-shell";
import { PraiseForm } from "@/components/praise-form";
import { fetchCategories } from "@/lib/praises";

export default async function NewPraisePage() {
  const categories = await fetchCategories();
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="칭찬하기" description="고마웠던 일을 짧게라도 남겨 주세요." />
      <PraiseForm categories={categories} />
    </div>
  );
}
