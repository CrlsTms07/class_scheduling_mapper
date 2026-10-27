import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { DoorClosed, Plus, SearchIcon } from "lucide-react";
import React from "react";
import Pagination from "../Pagination";
import { Link } from "react-router";

const ShsGenerateSchedule = () => {
  return (
    <>
      <div>
        <div className="p-3">
          <div className="flex justify-between items-center py-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#790D16]/20 rounded-sm">
                <DoorClosed className="text-branding size-5" />
              </div>
              <p className="text-sm text-neutral-700 font-medium">
                Building 14 - A
              </p>
            </div>
            <div>
              <InputGroup>
                <InputGroupInput
                  id="inline-start-input"
                  placeholder="Search..."
                />
                <InputGroupAddon align="inline-start">
                  <SearchIcon className="text-muted-foreground" />
                </InputGroupAddon>
              </InputGroup>
            </div>
          </div>
          <div className="grid grid-cols-3 grid-flow-row gap-5 mt-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Card key={i} className="shadow shadow-[#790D16]/40">
                <CardContent>
                  <div>
                    <div className="flex justify-between items-center gap-3">
                      <div>
                        <p className="text-teal-700 font-bold text-base">
                          Room: 10{i + 1} A
                        </p>
                      </div>
                      <Link to={`/index/room/${i + 1}`}>
                        <Button variant="outline" size="xs">
                          <Plus />
                          Add Section
                        </Button>
                      </Link>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    <p className="text-xs text-neutral-700">
                      Section in this building:
                    </p>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">STEM 11-1</Badge>
                      <Badge variant="secondary">STEM 12-1</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Pagination />
      </div>
    </>
  );
};

export default ShsGenerateSchedule;
