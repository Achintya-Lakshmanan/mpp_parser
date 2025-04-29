{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.nodePackages.npm
    pkgs.jdk11
    pkgs.yarn
    pkgs.replitPackages.jest
  ];
} 