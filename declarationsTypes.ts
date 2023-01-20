// this file is the beginning of discussions around the types of data being passed in declarations
// to facilitate discussion around how the declarations and the solver should be organized

interface UserDeclaration {
  [deployed: string]: [
    {
      [network: string]: [
        {
          contract: string;
          links?: Array<string>;
          options?: Array<string>
          dependsOn?: Array<string>;
          process?: ScriptObject;
        }
      ]
    }
  ]
}
type ScriptObject = {
  path: string;
  before?: string;
  after?: Array<string>;
  beforeEach?: Array<string>;
  afterEach?: Array<string>;
}

interface DeclarationTarget {
  contractName: string;
  network: string;
  // other contracts, any captured variables from a previous deployment
  // not sure what the best way to arrange these will be, just an array of any for now
  dependencies: Array<any>;
  //this will be a function to check whether the target in question
  //has finished successfully
  isCompleted: any;
  links: Array<string>;
  //this is the function to complete this target, this is the function that will
  //actually deploy, link, execute, etc.; ultimately the execution layer of the declarative
  //deployments module will look something like DeploymentSteps[0].run(contractName, options), etc.;
  run: Array<string>;
}

