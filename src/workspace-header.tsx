import {useData,api,act} from "./api";
import React from "react";
import { Icon } from "./ui";

export function WorkspaceHeader({
  user,
  section,
}: {
  user: { role: string; name: string };
  section?: string;
}) {
  const {data:config} = useData("config");
  const admin = user.role === "admin";
  const links = [
    {
      href: "/ucitel",
      label: admin ? "Předměty" : "Moje předměty",
      icon: "book",
      key: "predmety",
    },
    { href: "/ucitel/souteze", label: "Soutěže", icon: "quiz", key: "souteze" },
    {
      href: "/ucitel/vazba",
      label: "Zpětná vazba",
      icon: "feedback",
      key: "vazba",
    },
    ...(admin
      ? [
          {href:"/ucitel/ucty",label:"Učitelé",icon:"lock",key:"ucty"},
          {
            href: "/ucitel/uchovavani",label:"Uchovávání dat",icon:"lock",key:"uchovavani",
          },
        ]
      : []),
  ];
  const active =
    section === "ucty" || section === "uchovavani" || section === "souteze" || section === "vazba"
      ? section
      : "predmety";
  return (
    <header
      className={
        "workspace-header " + (admin ? "workspace-admin" : "workspace-teacher")
      }
    >
      <div className="wrap workspace-top">
        <a className="workspace-brand" href="/ucitel">
          <span className="workspace-mark">
            <Icon name="folio" size={25} />
          </span>
          <strong>Folio</strong>
          <span className="workspace-title">
            {admin ? "Administrace" : "Učitelský prostor"}
          </span>
        </a>
        <div className="workspace-account">
          <span className="workspace-name">{user.name}</span><button className="secondary" onClick={act(async()=>{await api("account/logout",{});location.assign("/ucitel")})}>Odhlásit se</button>
        </div>
      </div>
      <div className="workspace-menu">
        <div className="wrap workspace-links">
          <nav
            aria-label={admin ? "Navigace administrace" : "Navigace učitele"}
          >
            {links.map((link) => (
              <a
                key={link.key}
                href={link.href}
                aria-current={
                  link.key === active
                    ? location.pathname === link.href
                      ? "page"
                      : "location"
                    : undefined
                }
              >
                <Icon name={link.icon} size={17} />
                {link.label}
              </a>
            ))}
          </nav>
          <a href={config?.publicOrigin || "/"} className="workspace-library">
            Veřejná knihovna
          </a>
        </div>
      </div>
    </header>
  );
}
