
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
          if (true) {
            // Pre-fill with a complex use case.
            $scope.leftStr =
                '[{"a":15}, {"a":15, "c":-9}, [1, "2", {"a":false}, ' +
                '{"a":false}, "removed1", "rem2", true], 16, "9"]';
            $scope.rightStr =
                '[{"a":15}, {"a":15, "b":16}, [1, 2, [true], 6666], 17, 9,' +
                ' 9, [], {}, [1], {"a":2}]';
          } else {
            $scope.leftStr = '{"a":false}';
            $scope.rightStr = '[true]';
          }
          $scope.leftWarning = null;
          $scope.rightWarning = null;
          $scope.left = JSON.parse($scope.leftStr);
          $scope.right = JSON.parse($scope.rightStr);
          $scope.autoRefresh = true;
          $scope.autoPrettifyLeft = false;
          $scope.autoPrettifyRight = false;
          $scope.parsing = false;
          if (diffState) {
            $scope.leftStr = diffState.leftStr;
            $scope.rightStr = diffState.rightStr;
            $scope.autoRefresh = diffState.autoRefresh;
            $scope.autoPrettifyLeft = diffState.autoPrettifyLeft;
            $scope.autoPrettifyRight = diffState.autoPrettifyRight;
          }

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

          $scope.checkPrettify = function(isLeft) {
            if (isLeft && $scope.autoPrettifyLeft ||
                !isLeft && $scope.autoPrettifyRight) {
              $scope.prettify(isLeft);
            }
          };

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

          $scope.refresh = function() {
            textAreaChanged(true, $scope.leftStr);
            textAreaChanged(false, $scope.rightStr);
          };

          $scope.checkRefresh = function() {
            if ($scope.autoRefresh) {
              $scope.refresh();
            }
          };

          $scope.doesJsonMatch = function() {
            return $scope.left !== undefined && $scope.right !== undefined &&
                _.isEqual($scope.left, $scope.right);
          };

          $scope.save = function() {
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
                  data: 'state_json=' + stateJson,
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
