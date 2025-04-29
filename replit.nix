{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.openjdk11
    pkgs.nodePackages.typescript-language-server
    pkgs.yarn
    pkgs.unzip
    pkgs.wget
  ];
} 