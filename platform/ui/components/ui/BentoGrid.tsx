"use client";
import { useState } from "react";
import { IoCopyOutline } from "react-icons/io5";
import dynamic from "next/dynamic";

// Dynamically import Lottie with no SSR
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

import { cn } from "@/lib/utils";
import { BackgroundGradientAnimation } from "./GradientBg";
const GridGlobe = dynamic(() => import("./GridGlobe"), { ssr: false });
import animationData from "@/data/confetti.json";
import MagicButton from "./MagicButton";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-6 lg:grid-cols-5 md:grid-row-7 gap-4 lg:gap-8 mx-auto",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  id,
  title,
  description,
  img,
  imgClassName,
  titleClassName,
  spareImg,
}: {
  className?: string;
  id: number;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  img?: string;
  imgClassName?: string;
  titleClassName?: string;
  spareImg?: string;
}) => {
  const leftLists = ["ReactJS", "Python", "Typescript"];
  const rightLists = ["NextJS", "LangChain", "GraphQL"];

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = "lelu@ai-auth.com"; // Customized for Lelu
    navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <div
      className={cn(
        "row-span-1 relative overflow-hidden rounded-3xl border border-white/[0.1] group/bento hover:shadow-xl transition duration-200 shadow-input dark:shadow-none justify-between flex flex-col space-y-4 bg-white dark:bg-black-100",
        className,
      )}
    >
      <div className={`${id === 6 && "flex justify-center"} h-full`}>
        <div className="w-full h-full absolute">
          {img && (
            <img src={img} alt={img} className={cn(imgClassName, "object-cover object-center ")} />
          )}
        </div>
        <div className={`absolute right-0 -bottom-5 ${id === 5 && "w-full opacity-80"} `}>
          {spareImg && (
            <img
              src={spareImg}
              alt={spareImg}
              className="object-cover object-center w-full h-full"
            />
          )}
        </div>
        {id === 6 && (
          <BackgroundGradientAnimation>
            <div className="absolute z-50 inset-0 flex items-center justify-center text-white font-bold px-4 pointer-events-none text-3xl text-center md:text-4xl lg:text-7xl"></div>
          </BackgroundGradientAnimation>
        )}

        <div
          className={cn(
            titleClassName,
            "group-hover/bento:translate-x-2 transition duration-200 relative md:h-full min-h-40 flex flex-col px-5 p-5 lg:p-10",
          )}
        >
          <div className="font-sans font-extralight md:max-w-32 md:text-xs lg:text-base text-sm dark:text-[#C1C2D3] text-zinc-600 z-10">
            {description}
          </div>
          <div className={`font-sans text-lg lg:text-3xl max-w-96 font-bold z-10`}>{title}</div>

          {id === 2 && <GridGlobe />}

          {id === 3 && (
            <div className="flex gap-1 lg:gap-5 w-fit absolute -right-3 lg:-right-2">
              <div className="flex flex-col gap-3 md:gap-3 lg:gap-8">
                {leftLists.map((item, i) => (
                  <span
                    key={i}
                    className="lg:py-4 lg:px-3 py-2 px-3 text-xs lg:text-base opacity-50 
                    lg:opacity-100 rounded-lg text-center dark:bg-[#10132E] bg-zinc-100 border border-zinc-200 dark:border-none"
                  >
                    {item}
                  </span>
                ))}
                <span className="lg:py-4 lg:px-3 py-4 px-3  rounded-lg text-center dark:bg-[#10132E] bg-zinc-100"></span>
              </div>
              <div className="flex flex-col gap-3 md:gap-3 lg:gap-8">
                <span className="lg:py-4 lg:px-3 py-4 px-3  rounded-lg text-center dark:bg-[#10132E] bg-zinc-100"></span>
                {rightLists.map((item, i) => (
                  <span
                    key={i}
                    className="lg:py-4 lg:px-3 py-2 px-3 text-xs lg:text-base opacity-50 
                    lg:opacity-100 rounded-lg text-center dark:bg-[#10132E] bg-zinc-100 border border-zinc-200 dark:border-none"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          {id === 6 && (
            <div className="mt-5 relative">
              <div className={`absolute -bottom-5 right-0 ${copied ? "block" : "block"}`}>
                <Lottie
                  animationData={animationData}
                  loop={copied}
                  autoplay={copied}
                  style={{ height: 200, width: 400 }}
                />
              </div>

              <MagicButton
                title={copied ? "Email is Copied!" : "Copy my email address"}
                icon={<IoCopyOutline />}
                position="left"
                handleClick={handleCopy}
                otherClasses="dark:!bg-[#161A31] !bg-zinc-100 !text-black dark:!text-white border border-zinc-200 dark:border-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
