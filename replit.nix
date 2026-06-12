# System dependencies for the Kalshi Intel dashboard (kalshi-intel/).
# openssl is required by Prisma's query engine.
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.openssl
  ];
}
