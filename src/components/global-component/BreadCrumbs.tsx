import React from "react";
import { Link, useLocation } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { DotIcon, SquareArrowOutUpRight } from "lucide-react";

const BreadCrumbs = () => {
  const { pathname } = useLocation();
  const paths = pathname
    .split("/")
    .filter(Boolean)
    .map((segment, index, array) => ({
      label: segment,
      href: "/" + array.slice(0, index + 1).join("/"),
      isLast: index === array.length - 1,
    }));

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <SquareArrowOutUpRight className="size-5" />
        <Breadcrumb>
          <BreadcrumbList>
            {paths.map(({ label, href, isLast }) => (
              <React.Fragment key={href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="text-sm font-medium text-branding border-b p-1">
                      {label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={<Link to={href}>{label}</Link>}
                    ></BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && (
                  <BreadcrumbSeparator>
                    <DotIcon />
                  </BreadcrumbSeparator>
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </>
  );
};

export default BreadCrumbs;
