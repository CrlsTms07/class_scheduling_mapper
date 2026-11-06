import { Button } from "@/components/ui/button";

const Pagination = () => {
  return (
    <>
      <div className="flex items-center justify-between p-3">
        <div>
          <p>Page 1 of 1</p>
        </div>
        <div>
          <div className="space-x-2">
            <Button variant="outline" className="w-20" size="sm">
              Previous
            </Button>
            <Button variant="outline" className="w-20" size="sm">
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Pagination;
