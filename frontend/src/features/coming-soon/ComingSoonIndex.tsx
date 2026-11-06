const ComingSoonIndex = ({ title }: { title: string }) => {
  return (
    <div className="p-4 sm:p-6">
      <p className="text-branding text-xl font-medium">{title}</p>
      <p className="text-sm text-neutral-700">This page is being built.</p>
    </div>
  );
};

export default ComingSoonIndex;
