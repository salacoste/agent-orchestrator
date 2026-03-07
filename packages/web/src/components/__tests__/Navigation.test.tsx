import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Navigation } from "../Navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Navigation", () => {
  it("renders navigation menu with Dashboard, Fleet, Events, Settings links", () => {
    render(<Navigation currentPath="/" />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /fleet/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /events/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("highlights the current page in navigation", () => {
    render(<Navigation currentPath="/fleet" />);

    const fleetLink = screen.getByRole("link", { name: /fleet/i });
    expect(fleetLink).toHaveClass("active");
  });

  it("is responsive with collapsible mobile menu", () => {
    const { container } = render(<Navigation currentPath="/" />);

    // Mobile menu button should exist
    const menuButton = container.querySelector('button[aria-label="Toggle navigation menu"]');
    expect(menuButton).toBeInTheDocument();

    // Desktop links should be hidden on mobile (md:hidden class)
    const desktopLinks = container.querySelectorAll(".hidden.md\\:flex");
    expect(desktopLinks.length).toBeGreaterThan(0);
  });

  it("toggles mobile menu when button is clicked", () => {
    const { container } = render(<Navigation currentPath="/" />);

    const menuButton = container.querySelector(
      'button[aria-label="Toggle navigation menu"]',
    ) as HTMLElement;

    // Initially mobile menu should not be visible
    const mobileMenu = container.querySelector('div[class*="border-t"]');
    expect(mobileMenu).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(menuButton);

    // Now mobile menu should be visible
    const openedMenu = container.querySelector('div[class*="border-t"]');
    expect(openedMenu).toBeInTheDocument();
  });

  it("closes mobile menu when link is clicked", () => {
    const { container } = render(<Navigation currentPath="/" />);

    const menuButton = container.querySelector(
      'button[aria-label="Toggle navigation menu"]',
    ) as HTMLElement;

    // Open menu
    fireEvent.click(menuButton);
    const mobileMenu = container.querySelector('div[class*="border-t"]');
    expect(mobileMenu).toBeInTheDocument();

    // Click a mobile link (first link with block display)
    const mobileLinks = container.querySelectorAll("a.block");
    const firstMobileLink = mobileLinks[0] as HTMLElement;
    fireEvent.click(firstMobileLink);

    // Menu should be closed after clicking
    const closedMenu = container.querySelector('div[class*="border-t"]');
    expect(closedMenu).toBeNull();
  });
});
