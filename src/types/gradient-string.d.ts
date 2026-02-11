declare module "gradient-string" {
  type GradientFunction = ((...text: string[]) => string) & {
    multiline: (...text: string[]) => string;
  };

  type Gradient = (...colors: string[]) => GradientFunction;

  const gradient: Gradient;

  export default gradient;
}
