# RudderStack Transformation Action

This Github Action allows developers to test and publish user transformations and custom libraries directly from their development repository. To know more about user transformations check [here](https://rudderstack.com/docs/transformations).

## Usage

```yaml
name: Rudder Transformer Test and Publish
uses: rudderlabs/rudder-transformation-action@<version>
with:
    metaPath: './code/meta.json'
    email: 'test@rudderlabs.com'
    accessToken: ${{ secrets.ACCESS_TOKEN }}
    uploadTestArtifact: true
```

> Note: The action does the work of testing a transformation for a given set of events, it's creation and updation along with any custom libraries using the [transformation API](https://rudderstack.com/docs/transformations/rudderstack-transformation-api/). Read more in [this blog post](https://rudderstack.com/blog/rudderstacks-transformations-api). 

> For the action to work, one would need the workspace email and accessToken. Learn how to generate accessToken [here](https://rudderstack.com/docs/transformations/api-access-token/)

> For examples of using the action, checkout this [sample repository](https://github.com/rudderlabs/rudder-transformation-action-code/tree/main/.github/workflows)

> We recommend using git secrets to store your accessToken for security purposes and use it as mentioned in the above example

## Action Spec

### Inputs

- `email` (required) : RudderStack app workspace email.
- `accessToken` (required) : RudderStack app corresponding accessToken.
- `uploadTestArtifact` (optional) : boolean flag on whether to upload the individual transformation outputs after running the  transformation on the test events and it's diff from expected output for each.
	- When test-input-file is provided, actual outputs of all transformations with respective inputs from test-input-file are dumped into artifacts
	- When expected-output is provided, the above outputs are validated against the contents in expected-output and a diff is returned in artifacts if there is any.
	- Transformation outputs of the test data is written in its respective `camelCase(Name)_output` file
- `metaPath` (required) : The path to the meta file, the meta file let's the action know what transformations and libraries to test based on set of input events and the expected output, as well publish these transformations and libraries if the test passes.

      Meta file structure

     ```jsx
      // Meta file schema
      {
        "transformations" : <array of transformationSchema>,
        "libraries" : <array of librarySchema>
      }
     ```
      
     ```jsx
      // single transformationSchema
      {
        "file" (required): <path to the transformation code>,
        "name" (required): <transformation name>,
        "description" (optional): <transformation description>,
        "test-input-file" (optional) : <path to file containing an array of events to test the transformation>,
        "expected-output" (optional) : <path to file containing an array of expected output for the above input after running the transformation code>
      }
     ```
      
     ```jsx
      // single librarySchema
      {
        "file" (required): <path to the library code>,
        "name" (required): <library name: this is the name by which to import it in any transformation code>,
        "description" (optional): <library description> ,
      }
     ```
      
     ```jsx
      // example meta.json
      {
        "transformations": [
          {
            "file": "./code/t1.js",
            "name": "action-T1",
            "description": "action-T1",
            "test-input-file": "./code/events.json",
            "expected-output": "./code/expected.json"
          },
          {
            "file": "./code/t2.js",
            "name": "action-T2",
            "description": "action-T2"
          }
        ],
        "libraries": [
          {
            "file": "./code/lib1.js",
            "name": "lib1",
            "description": "action-lib1"
          },
          {
            "file": "./code/lib2.js",
            "name": "lib2",
            "description": "action-lib2"
          }
        ]
      }
     ```

> Note: All paths to files above should be relative to the base repo path

