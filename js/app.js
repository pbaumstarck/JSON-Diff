
/**
 * The encoded state of the application. This is what we send back to the
 * server upon a request to save the state, and how we re-populate the app
 * when loaded with saved state.
 * @typedef {leftStr: string,
 *           rightStr: string,
 *           autoRefresh: boolean,
 *           autoPrettifyLeft: boolean,
 *           autoPrettifyRight: boolean}
 */
var AppState;

/**
 * This is the state of the application as passed in from the controller.
 * It is inlined on the 'index.html' page and used here.
 * @type {?AppState}
 */
// var diffState;

/**
 * Gets the type of the element.
 * @param {*} element An element whose type is desired.
 * @return {string} One of 'object', 'array', or 'primitive'.
 */
function getType(element) {
  var type = typeof element;
  if (type == 'undefined') {
    return 'object';
  } else if (type == 'object') {
    return element instanceof Array ? 'array' : 'object';
  } else {
    return 'primitive';
  }
}

angular.module('DiffJson', ['ui.bootstrap']).
    directive('djDiff', function() {
      return {
        controller: function($scope, $timeout, $http) {
          // Pre-fill with a complex use case.
          $scope.leftStr =
              '[{"a":15}, {"a":15, "c":-9}, [1, "2", {"a":false}, ' +
              '{"a":false}, "removed1", "rem2", true], 16, "9"]';
          $scope.rightStr =
              '[{"a":15}, {"a":15, "b":16}, [1, 2, [true], 6666], 17, 9,' +
              ' 9, [], {}, [1], {"a":2}]';
          /**
           * An optional warning to display in the left 'textarea' on errors.
           * @type {string}
           */
          $scope.leftWarning = null;
          /**
           * An optional warning to display in the right 'textarea' on errors.
           * @type {string}
           */
          $scope.rightWarning = null;
          /**
           * The parsed JSON object from the left 'textarea'.
           * @type {*}
           */
          $scope.left = JSON.parse($scope.leftStr);
          /**
           * The parsed JSON object from the right 'textarea'.
           * @type {*}
           */
          $scope.right = JSON.parse($scope.rightStr);
          /**
           * Whether to auto-refresh the computed diff.
           * @type {boolean}
           */
          $scope.autoRefresh = true;
          /**
           * Whether to auto-prettify the left 'textarea'.
           * @type {boolean}
           */
          $scope.autoPrettifyLeft = false;
          /**
           * Whether to auto-prettify the right 'textarea'.
           * @type {boolean}
           */
          $scope.autoPrettifyRight = false;
          /**
           * This flag lets the UI display a waiting state when the system
           * is parsing/evaluating input changes.
           * @type {boolean}
           */
          $scope.parsing = false;

          if (diffState) {
            // Load our state from that passed in by the server.
            $scope.leftStr = diffState.leftStr;
            $scope.rightStr = diffState.rightStr;
            $scope.autoRefresh = diffState.autoRefresh;
            $scope.autoPrettifyLeft = diffState.autoPrettifyLeft;
            $scope.autoPrettifyRight = diffState.autoPrettifyRight;
          }

          /**
           * Responds to changes in the left and right 'textarea's in a
           * de-bounced fashion.
           * @param {boolean} isLeft Whether the change came from the left or
           *     the right 'textarea'.
           * @param {string} value The new value.
           */
          function textAreaChanged(isLeft, value) {
            $scope.parsing = true;
            try {
              var parsed = JSON.parse(value);
              // If the parse was successful, we have to set the destination
              // field to 'undefined' for a second to trick the view to
              // update to something other than a valid diff. Then, when we
              // assert the right value after the '$timeout', the diff will
              // appear correctly.
              if (isLeft) {
                $scope.left = undefined;
              } else {
                $scope.right = undefined;
              }
              $timeout(function() {
                $scope.parsing = false;
                if (isLeft) {
                  $scope.left = parsed;
                  if ($scope.autoPrettifyLeft) {
                    $scope.prettify(true);
                  }
                } else {
                  $scope.right = parsed;
                  if ($scope.autoPrettifyRight) {
                    $scope.prettify(false);
                  }
                }
              }, 1);
            } catch (e) {
              $scope.parsing = false;
              if (isLeft) {
                $scope.leftWarning = e.toString();
                $scope.left = undefined;
              } else {
                $scope.rightWarning = e.toString();
                $scope.right = undefined;
              }
            }
          }

          // De-bounce the above event handler for the two 'textarea's.
          var debounceDelay = 200;
          var leftChanged = _.debounce(function(value) {
            $scope.$apply(function() {
              textAreaChanged(true, value);
            });
          }, debounceDelay);
          var rightChanged = _.debounce(function(value) {
            $scope.$apply(function() {
              textAreaChanged(false, value);
            });
          }, debounceDelay);

          // Attach the de-bounced change handlers to the 'textarea's.
          var lastLeftStr = $scope.leftStr;
          var lastRightStr = $scope.rightStr;
          $('#left-textarea').bind('keyup paste', function (e) {
            var value = $(this).val();
            if (value != lastLeftStr) {
              lastLeftStr = value;
              if ($scope.autoRefresh) {
                leftChanged(value);
              }
            }
          });
          $('#right-textarea').bind('keyup paste', function (e) {
            var value = $(this).val();
            if (value != lastRightStr) {
              lastRightStr = value;
              if ($scope.autoRefresh) {
                rightChanged(value);
              }
            }
          });

          /**
           * Checks whether we are supposed to prettify the given 'textarea',
           * and then does so.
           * @param {boolean} isLeft Whether the left or the right 'textarea'.
           */
          $scope.checkPrettify = function(isLeft) {
            if (isLeft && $scope.autoPrettifyLeft ||
                !isLeft && $scope.autoPrettifyRight) {
              $scope.prettify(isLeft);
            }
          };

          /**
           * Auto-prettifies the given 'textarea'.
           * @param {boolean} isLeft Whether the left or the right 'textarea'.
           */
          $scope.prettify = function(isLeft) {
            if (isLeft) {
              if ($scope.left) {
                $scope.leftStr = JSON.stringify($scope.left, null, 2);
              }
            } else {
              if ($scope.right) {
                $scope.rightStr = JSON.stringify($scope.right, null, 2);
              }
            }
          };

          /* Refreshes the UI manually. */
          $scope.refresh = function() {
            textAreaChanged(true, $scope.leftStr);
            textAreaChanged(false, $scope.rightStr);
          };

          /* Checks whether we should refresh the UI, and does so. */
          $scope.checkRefresh = function() {
            if ($scope.autoRefresh) {
              $scope.refresh();
            }
          };

          /**
           * @return {boolean} Whether the left and right JSON objets match
           *     exactly. Used to toggle UI colors.
           */
          $scope.doesJsonMatch = function() {
            return $scope.left !== undefined && $scope.right !== undefined &&
                _.isEqual($scope.left, $scope.right);
          };

          /**
           * Executes a request to save the state of the application.
           * On success, the server returns an alphanumeric ID to retrieve it
           * by, and we update the page history to point to that link.
           */
          $scope.save = function() {
            // Encode the state of the application.
            /* @type {!AppState} */
            var stateJson = JSON.stringify({
              leftStr: $scope.leftStr,
              rightStr: $scope.rightStr,
              autoRefresh: $scope.autoRefresh,
              autoPrettifyLeft: $scope.autoPrettifyLeft,
              autoPrettifyRight: $scope.autoPrettifyRight
            });
            $timeout(function() {
              $http({
                  method: 'POST',
                  url: '/_save',
                  data: 'state_json=' + encodeURIComponent(stateJson),
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                  }
              }).success(function(response) {
                if (!response.success) {
                  alert(response.message);
                } else {
                  history.pushState(response, '', '/' + response.model_id);
                }
              });
            }, 200);
          };

          if (diffState) {
            $scope.refresh();
          }
        },
        replace: true,
        restrict: 'AE',
        templateUrl: '/tang/diffctrl.html'
      };
    }).
    // Displays the diff between any two JSON elements of variable type.
    // This gets their type and instantiates the proper sub-directives for
    // display.
    directive('djElements', function() {
      return {
        controller: function($scope) {
          $scope.leftType = getType($scope.left);
          $scope.rightType = getType($scope.right);
        },
        replace: true,
        restrict: 'AE',
        scope: {
          left: '=',
          right: '=',
          hasLeft: '=',
          hasRight: '='
        },
        template: '<span class="diff-elements">' +
                  '  <span ng-if="hasRight && hasLeft">' +
                  '    <span ng-if="leftType == rightType">' +
                  '      <dj-objects ng-if="leftType == \'object\'"' +
                  '                  has-left="hasLeft" left="left"' +
                  '                  has-right="hasRight" right="right"></dj-objects>' +
                  '      <dj-arrays ng-if="leftType == \'array\'"' +
                  '                 has-left="hasLeft" left="left"' +
                  '                 has-right="hasRight" right="right"></dj-arrays>' +
                  '      <dj-primitives ng-if="leftType == \'primitive\'"' +
                  '                     has-left="hasLeft" left="left"' +
                  '                     has-right="hasRight" right="right"></dj-primitives>' +
                  '    </span>' +
                  '    <span ng-if="leftType != rightType">' +
                  '      <span class="removed">' +
                  '        <dj-objects ng-if="leftType == \'object\'"' +
                  '                    has-left="true" left="left"' +
                  '                    has-right="false" right="null"></dj-objects>' +
                  '        <dj-arrays ng-if="leftType == \'array\'"' +
                  '                   has-left="true" left="left"' +
                  '                   has-right="false" right="null"></dj-arrays>' +
                  '        <dj-primitives ng-if="leftType == \'primitive\'"' +
                  '                       has-left="true" left="left"' +
                  '                       has-right="false" right="null"></dj-primitives>' +
                  '      </span>' +
                  '      <span class="added">' +
                  '        <dj-objects ng-if="rightType == \'object\'"' +
                  '                    has-left="false" left="null"' +
                  '                    has-right="true" right="right"></dj-objects>' +
                  '        <dj-arrays ng-if="rightType == \'array\'"' +
                  '                   has-left="false" left="null"' +
                  '                   has-right="true" right="right"></dj-arrays>' +
                  '        <dj-primitives ng-if="rightType == \'primitive\'"' +
                  '                       has-left="false" left="null"' +
                  '                       has-right="true" right="right"></dj-primitives>' +
                  '      </span>' +
                  '    </span>' +
                  '  </span>' +
                  '  <span ng-if="!hasRight && hasLeft" class="removed">' +
                  '    <dj-objects ng-if="leftType == \'object\'"' +
                  '                has-left="true" left="left"' +
                  '                has-right="false" right="null"></dj-objects>' +
                  '    <dj-arrays ng-if="leftType == \'array\'"' +
                  '               has-left="true" left="left"' +
                  '               has-right="false" right="null"></dj-arrays>' +
                  '    <dj-primitives ng-if="leftType == \'primitive\'"' +
                  '                   has-left="true" left="left"' +
                  '                   has-right="false" right="null"></dj-primitives>' +
                  '  </span>' +
                  '  <span ng-if="hasRight && !hasLeft" class="added">' +
                  '    <dj-objects ng-if="rightType == \'object\'"' +
                  '                has-left="false" left="null"' +
                  '                has-right="true" right="right"></dj-objects>' +
                  '    <dj-arrays ng-if="rightType == \'array\'"' +
                  '               has-left="false" left="null"' +
                  '               has-right="true" right="right"></dj-arrays>' +
                  '    <dj-primitives ng-if="rightType == \'primitive\'"' +
                  '                   has-left="false" left="null"' +
                  '                   has-right="true" right="right"></dj-primitives>' +
                  '  </span>' +
                  '</span>'
      };
    }).
    // Displays the diff between two objects (hash maps). Recurses to use
    // the 'dj-elements' directive to compare the corresponding values of the
    // objects.
    directive('djObjects', function($compile) {
      return {
        controller: function($scope) {
          $scope._ = _;
          $scope.allKeys = [];
          if ($scope.left && $scope.right) {
            $scope.allKeys = _.union(_.keys($scope.left), _.keys($scope.right));
          } else if ($scope.left) {
            $scope.allKeys = _.keys($scope.left);
          } else if ($scope.right) {
            $scope.allKeys = _.keys($scope.right);
          }

          $scope.hasKey = function(side, key) {
            return side && _.has(side, key);
          };
        },
        replace: true,
        restrict: 'AE',
        scope: {
          left: '=',
          right: '=',
          hasLeft: '=',
          hasRight: '='
        },
        template: '<span class="diff-objects"></span>',
        transclude: true,
        link: function ($scope, $element) {
          $element.append(
              '<span ng-if="hasLeft && left == null && hasRight && right == null">' +
              '  null' +
              '</span>' +
              '<span ng-if="hasLeft && left == null && (!hasRight || right != null)" class="removed">' +
              '  null' +
              '</span>' +
              '<span ng-if="hasLeft && left != null || hasRight && right != null"' +
              '      ng-class="{removed: hasLeft && left != null && hasRight && right == null,' +
              '                 added: hasLeft && left == null && hasRight && right != null}">' +
              '  <span class="bracket object-bracket open-bracket">{</span>' +
              '  <span class="object-item" ng-repeat="key in allKeys">' +
              '    <span class="ordinal object-key" ' +
              '          ng-class="{removed: !hasKey(right, key), added: !hasKey(left, key)}">{{ key }}</span>' +
              '    <span class="object-value">' +
              '      <dj-elements has-left="hasKey(left, key)" left="left[key]"' +
              '                   has-right="hasKey(right, key)" right="right[key]"></dj-elements>' +
              '    </span>' +
              '    <span class="delimiter object comma" ng-if="!$last">,</span>' +
              '  </span>' +
              '  <span class="bracket object-bracket close-bracket">}</span>' +
              '</span>' +
              '<span ng-if="(!hasLeft || left != null) && hasRight && right == null" class="added">' +
              '  null' +
              '</span>');
          $compile($element.contents())($scope);
        }
      };
    }).
    // Displays the diff between two arrays. Recurses to use the 'dj-elements'
    // directive to compare the corresponding array elements.
    directive('djArrays', function($compile) {
      return {
        controller: function($scope) {
          $scope._ = _;
          $scope.maxLength = 0;
          if ($scope.left && $scope.right) {
            $scope.maxLength = Math.max($scope.left.length, $scope.right.length);
          } else if ($scope.left) {
            $scope.maxLength = $scope.left.length;
          } else if ($scope.right) {
            $scope.maxLength = $scope.right.length;
          }
        },
        replace: true,
        restrict: 'AE',
        scope: {
          left: '=',
          right: '=',
          hasLeft: '=',
          hasRight: '='
        },
        template: '<span class="diff-arrays"></span>',
        transclude: true,
        link: function ($scope, $element) {
          $element.append(
              '<span class="bracket array-bracket open-bracket">[</span>' +
              '<span class="array-item" ng-repeat="i in _.range(maxLength)">' +
              '  <span class="ordinal array-index"' +
              '        ng-class="{removed: i >= right.length, added: i >= left.length}">{{ i }}</span>' +
              '  <span class="array-item-value">' +
              '    <dj-elements has-left="i < left.length" left="left[i]"' +
              '                 has-right="i < right.length" right="right[i]"></dj-elements>' +
              '  </span>' +
              '  <span class="delimiter array comma" ng-if="!$last">,</span>' +
              '</span>' +
              '<span class="bracket array-bracket close-bracket">]</span>');
          $compile($element.contents())($scope);
        }
      };
    }).
    // Displays the diff between two primitive (non-object, non-array) values.
    // This does not need to recurse and is terminal.
    directive('djPrimitives', function() {
      return {
        controller: function($scope) {
          $scope.JSON = JSON;
        },
        replace: true,
        restrict: 'AE',
        scope: {
          left: '=',
          right: '=',
          hasLeft: '=',
          hasRight: '='
        },
        template: '<span class="diff-primitives">' +
                  '  <span ng-if="hasLeft && hasRight">' +
                  '    <span ng-if="left === right">' +
                  '      <span class="primitive-value" ng-tooltip="leftType">' +
                  '        {{ JSON.stringify(left) }}' +
                  '      </span>' +
                  '    </span>' +
                  '    <span ng-if="left !== right">' +
                  '      <span class="primitive-value removed" ng-tooltip="leftType">' +
                  '        {{ JSON.stringify(left) }}' +
                  '      </span>' +
                  '      <span class="primitive-value added" ng-tooltip="rightType">' +
                  '        {{ JSON.stringify(right) }}' +
                  '      </span>' +
                  '    </span>' +
                  '  </span>' +
                  '  <span ng-if="hasRight && !hasLeft">' +
                  '    <span class="primitive-value added" ng-tooltip="rightType">' +
                  '      {{ JSON.stringify(right) }}' +
                  '    </span>' +
                  '  </span>' +
                  '  <span ng-if="!hasRight && hasLeft">' +
                  '    <span class="primitive-value removed" ng-tooltip="leftType">' +
                  '      {{ JSON.stringify(left) }}' +
                  '    </span>' +
                  '  </span>' +
                  '</span>',
        transclude: true
      };
    });
