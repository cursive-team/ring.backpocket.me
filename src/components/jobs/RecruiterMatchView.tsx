import { AppContent } from "@/components/AppContent";
import { Button } from "@/components/Button";
import { Card } from "@/components/cards/Card";
import { Icons } from "@/components/Icons";
import { Modal } from "@/components/modals/Modal";
import { Tabs } from "@/components/Tabs";
import { FormStepLayout } from "@/layouts/FormStepLayout";
import { classed } from "@tw-classed/react";
import Link from "next/link";
import React, { useState } from "react";
import { Banner } from "../Banner";
import { ArtworkSnapshot } from "../artwork/ArtworkSnapshot";
import { Accordion } from "../Accordion";

const Title = classed.span("text-white text-xs font-normal font-inter");
const Description = classed.h5("text-white/50 font-inter font-normal text-sm");
const LinkCard = classed.div("p-3 border border-white/20");

interface OpportunityCardProps {
  label: string;
  description?: string;
  onClick?: () => void;
}

const LinkCardBox = ({ label, value, href }: any) => {
  return (
    <Link href={href ?? "#"} target="_blank">
      <div className="grid items-center grid-cols-[auto_1fr_auto] gap-1">
        <span className="text-sm text-white/50 font-inter font-normal leading-6">
          {label}
        </span>
        <div className="h-[1px] bg-white/20 w-full"></div>
        <span className="text-right">{value ?? "N/A"}</span>
      </div>
    </Link>
  );
};

const OpportunityCard = ({
  label,
  description,
  onClick = () => {},
  ...props
}: OpportunityCardProps) => {
  return (
    <div
      className="hover:bg-gray/30 first-of-type:border-t first-of-type:border-t-white/20 border-b border-b-white/20 py-6"
      onClick={onClick}
      {...props}
    >
      <AppContent className="flex items-center justify-between">
        <div className="flex flex-col ">
          <span className="text-white font-inter text-sm font-medium">
            {label}
          </span>
          <span className="text-white/50 font-inter text-xs">
            {description}
          </span>
        </div>
        <button>
          <Icons.ArrowRight size={24} />
        </button>
      </AppContent>
    </div>
  );
};
export default function RecruiterMatchView() {
  const [showMatch, setShowMatch] = useState(false);
  const hasOpportunities = true;
  const hasOptedIn = true;
  const isBookmarked = false;

  return (
    <>
      <Modal
        isOpen={showMatch}
        setIsOpen={setShowMatch}
        withBackButton
        actions={
          <button className=" absolute right-6 cursor-pointer">
            {isBookmarked ? <Icons.BookmarkActive /> : <Icons.Bookmark />}
          </button>
        }
      >
        <FormStepLayout className="h-full">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 xs:gap-5 items-center">
              <div className="w-32 h-32 rounded-[4px] relative flex-shrink-0">
                <ArtworkSnapshot width={128} height={128} pubKey={""} />
                <button type="button" className="absolute right-1 top-1 z-1">
                  <Icons.Zoom />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <h2 className="text-xl text-white font-semibold font-inter leading-6 tracking-[-0.1px]">
                  Name
                </h2>
                <div className="flex items-center gap-1">
                  <span
                    className="text-white/50 text-xs font-inter font-medium mt-1 left-5"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    Bio
                  </span>
                </div>
              </div>
            </div>
            <Accordion label="Contact">
              <LinkCardBox
                label="Email"
                value="example@gmail.com"
              ></LinkCardBox>
            </Accordion>
            <Accordion label="Dev stats">
              <LinkCardBox
                label="Github"
                value="example@gmail.com"
              ></LinkCardBox>
            </Accordion>

            <Accordion label="Qualifications">
              <div className="flex flex-col gap-2">
                <LinkCardBox
                  label="Education"
                  value={<span className="text-white">value</span>}
                />
                <LinkCardBox
                  label="Interests"
                  value={<span className="text-white">value</span>}
                />
                <LinkCardBox
                  label="Desired title "
                  value={<span className="text-white">value</span>}
                />
                <LinkCardBox
                  label="Preferred stage "
                  value={<span className="text-white">value</span>}
                />
              </div>
            </Accordion>
          </div>
        </FormStepLayout>
      </Modal>
      <Tabs
        items={[
          {
            label: "Respondents",
            children: (
              <div className="flex flex-col h-full">
                {!hasOpportunities ? (
                  <span className="mt-20 text-white/50 text-xs text-center">
                    No opportunities yet.{" "}
                  </span>
                ) : (
                  <div className="flex flex-col w-full">
                    <Banner
                      title="These candidates shared their contact info with you."
                      closable
                    />
                    <OpportunityCard
                      label="match 1"
                      description="example"
                      onClick={() => {
                        setShowMatch(true);
                      }}
                    />
                    <OpportunityCard
                      label="match 2"
                      description="example"
                      onClick={() => {
                        setShowMatch(true);
                      }}
                    />
                  </div>
                )}
              </div>
            ),
          },
          {
            label: "Bookmarked",
            children: (
              <div className="flex flex-col h-full">
                {!hasOptedIn ? (
                  <span className="mt-20 text-white/50 text-xs text-center">
                    No bookmarked yet.{" "}
                  </span>
                ) : (
                  <div className="flex flex-col w-full">
                    <OpportunityCard
                      label="bookmark 1"
                      description="example"
                      onClick={() => {
                        setShowMatch(true);
                      }}
                    />
                  </div>
                )}
              </div>
            ),
          },
        ]}
      ></Tabs>
    </>
  );
}