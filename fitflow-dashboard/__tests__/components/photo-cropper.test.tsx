import { StrictMode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PhotoCropper from "@/components/profile/PhotoCropper";

/**
 * react-easy-crop manipule la géométrie du DOM, que jsdom ne calcule pas. On le
 * remplace par un <img> qui expose la source reçue : c'est tout ce qu'on veut
 * vérifier ici — que l'URL passée au recadreur est encore valide au rendu.
 */
vi.mock("react-easy-crop", () => ({
  default: ({ image }: { image: string }) => <img alt="crop" data-testid="crop-image" src={image} />,
}));
vi.mock("react-easy-crop/react-easy-crop.css", () => ({}));

const revoked: string[] = [];

beforeEach(() => {
  revoked.length = 0;
  // jsdom n'implémente ni createObjectURL ni revokeObjectURL.
  URL.createObjectURL = vi.fn(() => "blob:photo-1");
  URL.revokeObjectURL = vi.fn((u: string) => void revoked.push(u));
});

const makeFile = () =>
  new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo.jpg", { type: "image/jpeg" });

describe("PhotoCropper", () => {
  it("garde l'URL de l'image valide sous StrictMode", () => {
    // StrictMode rejoue montage → nettoyage → remontage. Une révocation placée dans
    // le nettoyage d'un effet tuait l'URL avant le second rendu : le cadre restait
    // noir. C'est la régression que ce test verrouille.
    render(
      <StrictMode>
        <PhotoCropper file={makeFile()} onCancel={() => {}} onDone={() => {}} />
      </StrictMode>,
    );

    expect(screen.getByTestId("crop-image")).toHaveAttribute("src", "blob:photo-1");
    expect(revoked).toEqual([]);
  });

  it("libère l'URL à l'annulation", () => {
    const onCancel = vi.fn();
    render(<PhotoCropper file={makeFile()} onCancel={onCancel} onDone={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /annuler/i }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(revoked).toEqual(["blob:photo-1"]);
  });

  it("libère l'URL sur Échap", () => {
    const onCancel = vi.fn();
    render(<PhotoCropper file={makeFile()} onCancel={onCancel} onDone={() => {}} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(revoked).toEqual(["blob:photo-1"]);
  });
});
