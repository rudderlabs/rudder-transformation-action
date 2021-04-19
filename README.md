# RudderStack Transformation Action

This Github Action allows developers to test and publish user transformations and custom libraries directly from their development repository. To know more about user transformations check [here](https://docs.rudderstack.com/adding-a-new-user-transformation-in-rudderstack).

## Usage

```yaml
name: Rudder Transformer Test and Publish
uses: rudderlabs/rudder-transformation-action@<version>
with:
	metaPath: './code/meta.json'
	email: 'test@rudderlabs.com'
	accessKey: ${{ secrets.ACCESS_KEY }}
	serverEndpoint: 'https://api.rudderlabs.com'
	uploadTestArtifact: true
```

> Note: The action does the work of testing a transformation for a given set of events, it's creation and updation along with any custom libraries using the transformation API. To read more about check [here](https://rudderstack.com/blog/rudderstacks-transformations-api). For the action to work, one would need the workspace email and accessKey.

For examples of using the action, checkout the [rudder-transformation-action](https://github.com/rudderlabs/rudder-transformation-action/tree/main/.github/workflows) repository

## Action Spec

### Inputs

- `metaPath` (required) : The path to the meta file, the meta file let's the action know what transformations and libraries to test based on set of input events and the expected output, as well publish these transformations and libraries if the test passes.

      **Meta file structure**

```jsx
// Meta file schema
{
	"transformations" : <array of transformation meta information>,
	"libraries" : <array of libraries meta information>

}
```

```jsx
// single transformation schema
{
	"file" (required): <path to the transformation code>,
	"name" (required): <transformation name>,
	"description" (optional): <transformation description>,
	"type" (optional): <default as transformation>,
	"test-input-file" (optional) : <set of events to test the transformation>,
  "expected-output" (optional) : <expected set of output events for the above     input after running the transformation code>

}
```

```jsx
// single library schema
{
	"file" (required): <path to the library code>,
	"name" (required): <library name: this is the name by which to import it in any transformation code>,
	"description" (optional): <library description> ,
	"type" (optional): <default as library>
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
      "type": "transformation",
      "test-input-file": "./code/events.json",
      "expected-output": "./code/expected.json"
    },
    {
      "file": "./code/t2.js",
      "name": "action-T2",
      "description": "action-T2",
      "type": "transformation"
    }
  ],
	"libraries": [
    {
      "file": "./code/lib1.js",
      "name": "lib1",
      "description": "action-lib1",
      "type": "library"
    },
    {
      "file": "./code/lib2.js",
      "name": "lib2",
      "description": "action-lib2",
      "type": "library"
    }
  ]
}
```

> Note: All paths to files above should be relative to the base repo path

- `email` (required) : RudderStack app workspace email.
- `accessKey` (required) : RudderStack app corresponding accessKey.
- `uploadTestArtifact` (optional) : boolean flag on whether to upload the individual transformation outputs after running the  transformation on the test events and it's diff from expected output for each.