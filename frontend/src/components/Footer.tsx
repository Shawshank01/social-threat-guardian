import { Link } from "react-router-dom";
import type { FC, SVGProps } from "react";

const links = [
  { label: "Articles", to: "/articles" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "About", to: "/about" },
  { label: "API", to: "/api" },
];

const GithubIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path d="M12 .297a12 12 0 0 0-3.792 23.4c.6.113.82-.26.82-.577 0-.286-.012-1.232-.018-2.238-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.332-1.757-1.332-1.757-1.089-.744.083-.729.083-.729 1.204.085 1.838 1.237 1.838 1.237 1.07 1.833 2.809 1.304 3.492.998.108-.775.419-1.305.763-1.605-2.665-.304-5.467-1.332-5.467-5.928 0-1.31.468-2.382 1.236-3.222-.124-.303-.536-1.524.117-3.176 0 0 1.008-.323 3.3 1.23a11.5 11.5 0 0 1 3.004-.404c1.02.005 2.046.138 3.005.404 2.291-1.553 3.297-1.23 3.297-1.23.655 1.652.243 2.873.119 3.176.77.84 1.235 1.912 1.235 3.222 0 4.61-2.807 5.62-5.48 5.917.43.372.815 1.103.815 2.223 0 1.605-.015 2.898-.015 3.293 0 .32.216.694.826.576A12 12 0 0 0 12 .297Z" />
  </svg>
);

const Footer: FC = () => {
  return (
    <footer className="border-t border-slate-200/80 bg-white/90 transition-colors duration-200 dark:border-white/10 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 text-sm text-slate-600 dark:text-slate-300">
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-base">
          {links.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="transition hover:text-stg-accent hover:underline dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-3 text-center">
          <a
            href="https://github.com/Shawshank01/social-threat-guardian"
            className="flex items-center gap-2 text-slate-500 transition hover:text-stg-accent dark:text-slate-400 dark:hover:text-white"
            aria-label="GitHub repository"
          >
            <GithubIcon className="h-4 w-4" />
            <span>GitHub</span>
          </a>
          <span className="text-xs text-slate-500 dark:text-slate-400">© 2025 Zero Cool All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
