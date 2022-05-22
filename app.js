(function () {
    'use strict';

    var app = angular.module('gamescrubs', [
        'ui.router',
        'ui.bootstrap',
        'ngResource',
        '720kb.datepicker',
        'oitozero.ngSweetAlert',
        'dndLists',
        'ngStorage',
        'environment'
    ]);

    app.value('$', $);

    app.config(function ($stateProvider, $urlRouterProvider, envServiceProvider) {

        $stateProvider
            .state("home", { url: "/home", templateUrl: "main.html", controller: "MainController" })
            .state("bracket", { url: "/bracket", templateUrl: "bracketList.html", controller: "BracketController" })
            .state("bracketSearch", { url: "/bracket/:query", templateUrl: "bracketList.html", controller: "BracketController" })
            .state("manage", { url: "/bracket/manage/:id", templateUrl: "manage.html", controller: "BracketController" })
            .state("view", { url: "/bracket/view/:id", templateUrl: "view.html", controller: "ViewController" })
            .state("results", { url: "/bracket/results/:id", templateUrl: "results.html", controller: "ViewController" })
            .state("players", { url: "/bracket/players/:id", templateUrl: "players.html", controller: "BracketController" });

        $urlRouterProvider.otherwise("/home");

        envServiceProvider.config({
            domains: {
                development: ['localhost'],
                production: ['angular.gamescrubs.com'],
                local: ['localhost']
            },
            vars: {
                development: {
                    apiUrl: 'http://your.devapi.goes.here',
                },
                production: {
                    apiUrl: 'http://prod.api.goes.here',
                },
                local: {
                    apiUrl: 'http://localhost:56984',
                }
            }
        });


        envServiceProvider.check();

        envServiceProvider.set('development');

    });

})();
(function (module) {
    'use strict';

    var Enum = function() {
        return {
            BracketType: {
                0: '8 Single Elimination',
                1: '16 Single Elimination',
                2: '32 Single Elimination',
                3: '8 Double Elimination',
                4: '16 Double Elimination',
                5: '32 Double Elimination'
            },
            CompetitionType: {
                0: 'Video Game',
                1: 'Sport',
                2: 'Board Game',
                3: 'Other'
            },
            BracketStatus: {
                0: 'Setup',
                1: 'In Progress',
                2: 'On Hold',
                3: 'Completed'
            }
        }
    }

    module.constant('Enum', Enum).run(function ($rootScope) {
        $rootScope.Enum = new Enum;
    });;

})(angular.module("gamescrubs"));

(function (module) {
    'use strict';

    var BracketController = function ($scope, $filter, $state, $stateParams, $resource, $timeout, $sessionStorage, SweetAlert, Enum,
                                        Bracket, BracketService, ModalManagerService, Player, PlayerService) {

        $scope.query = $stateParams.query;

        $scope.id = $stateParams.id;

        $scope.maxPlayers = function () {

            if ($scope.brackets && $scope.brackets.Type) {
                var type = $scope.brackets.Type;

                if (type === 0 || type === 3)
                    return 8;

                if (type === 1 || type === 4)
                    return 16;

                if (type === 2 || type === 5)
                    return 32;
            }

            return 8;
        };

        $scope.models = {
            selected: null,
            players: null
        }

        $scope.manage = function (id) {

            var payLoad = {
                id: id,
                code: $sessionStorage.key
            }

            BracketService.validate(payLoad, function () {
                $scope.loadBracket(id);
            }, function () {
                $state.go("home");
            });
        }

        $scope.order = function (event, dropEffect) {

            var orderList = [];

            for (var i = 0; i < $scope.brackets.Players.length; i++) {
                orderList.push($scope.brackets.Players[i].ID);
            }

            PlayerService.order(orderList, function (data) { }, function (error) { });
        }

        var onLoadBracketsComplete = function (data) {
            $scope.brackets = data;
            $scope.brackets.Players = $filter('orderBy')($scope.brackets.Players, 'Seed');
        };

        var onLoadPlayersComplete = function (data) {
            $scope.brackets.Players = data;
        };

        var onValidateBracketsComplete = function (data) {

            if (data.isValid) {
                $sessionStorage.key = data.encrypted;
                $state.go("manage", { id: data.BracketID });
                swal.close();
            } else {
                SweetAlert.swal("Error", "Invalid Lock Code!", "error");
            }
        }

        var onUpdateBracketsComplete = function (data) {

            if (data.isValid) {
                $sessionStorage.key = data.encrypted;
            }
        }

        $scope.validateLockCode = function (id, isLocked) {

            if (isLocked) {
                swal({
                    title: "Enter Lock Code",
                    text: "Input bracket lock code to manage it.",
                    type: "input",
                    showCancelButton: true,
                    closeOnConfirm: false,
                    animation: "slide-from-top",
                    inputPlaceholder: "Code",
                    confirmButtonColor: "#3f51b5"
                }, function(inputValue) {

                    if (inputValue === false)
                        inputValue = "";

                    $scope.id = id;

                    var payLoad = {
                        id: id,
                        code: inputValue
                    }

                    BracketService.unlock(payLoad).$promise.then(onValidateBracketsComplete);


                });
            } else {

                $sessionStorage.key = '';
                $state.go("manage", { id: id });
            }
        }

        $scope.searchBracket = function (query) {
            BracketService.query({ id: query }).$promise.then(onLoadBracketsComplete);
        }

        $scope.startBracket = function () {

            var payLoad = {
                bracketId: $scope.id,
                status: 1,
                token: $sessionStorage.key
            }

            BracketService.status(payLoad, function () {
                $state.go("view", { id: $scope.id });
            });
        }

        $scope.loadBracket = function (id) {
            BracketService.get({ id: id }).$promise.then(onLoadBracketsComplete);
        }

        $scope.openBracketModal = function () {
            var instance = ModalManagerService.openBracketModal($scope.brackets, "templates/modalBracket.html", "animated zoomIn");

            instance.result.then(function (data) {
                var payLoad = {
                    id: data.ID,
                    code: data.LockCode
                }

                BracketService.unlock(payLoad).$promise.then(onUpdateBracketsComplete);
            });
        }

        $scope.openStatusModal = function () {
            ModalManagerService.openStatusModal($scope.brackets, "templates/modalStatus.html", "animated zoomIn");
        }

        $scope.openPlayerModal = function (player) {

            var isNewPlayer = false;

            // New player
            if (!player)
            {
                $scope.player = Player;
                $scope.player.ID = 0;
                $scope.player.PlayerName = '';
                $scope.player.BracketID = 0;
                $scope.player.Seed = 0;
                $scope.player.Score = 0;

                isNewPlayer = true;
            } else {
                $scope.player = player;
            }

            // Add bracket id to add new player to
            $scope.player.BracketID = $scope.id;

            // Open modal
            var instance = ModalManagerService.openPlayerModal($scope.player, "templates/modalPlayer.html", "animated zoomIn");

            // Process results
            instance.result.then(function (data) {

                if (isNewPlayer) {

                    $scope.brackets.Players.push(data);

                } else {

                    for (var i = 0; i < $scope.brackets.Players.length; i++) {
                        if ($scope.brackets.Players[i].ID === data.player.ID) {
                            $scope.brackets.Players[i] = data.player;
                            break;
                        }
                    }
                }

            }, function () {
                console.log('Modal dismissed at: ' + new Date());
            });

        }

        var removePlayer =  function(player) {

            $scope.brackets.Players.forEach(function (p, i) {
                if (player.ID === p.ID) {
                    $scope.brackets.Players.splice(i, 1);
                }
            });
        }

        $scope.deletePlayer = function (player) {

            SweetAlert.swal({
                title: "Delete Player " + player.PlayerName,
                text: "Are you sure you wish to delete this player?",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3f51b5",
                confirmButtonText: "Yes, delete it!",
                cancelButtonText: "No, cancel!",
                closeOnConfirm: true,
                closeOnCancel: false
            }, function (isConfirm) {
                if (isConfirm) {
                    PlayerService.delete({ id: player.ID, token: $sessionStorage.key }).$promise.then(removePlayer(player));
                } else {
                    SweetAlert.swal("Cancelled", "Bracket has not been deleted!", "error");
                }
            });
        }

        $scope.deleteBracket = function (id) {

            SweetAlert.swal({
                title: "Delete Bracket",
                text: "Are you sure you wish to delete this bracket?",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3f51b5",
                confirmButtonText: "Yes, delete it!",
                cancelButtonText: "No, cancel!",
                closeOnConfirm: false,
                closeOnCancel: false
            }, function (isConfirm) {
                if (isConfirm) {


                    BracketService.delete({ id: id, token: $sessionStorage.key }, function() {
                        swal({
                            title: "Bracket has been deleted",
                            text: "",
                            type: "success",
                            showCancelButton: false,
                            confirmButtonColor: "#3f51b5",
                            confirmButtonText: "Yes",
                            closeOnConfirm: true
                        }, function() {
                            $state.go("home");
                        });
                    });


                } else {
                    SweetAlert.swal("Cancelled", "Bracket has not been deleted!", "error");
                }
            });


        }
    };

    module.controller('BracketController', BracketController);

})(angular.module("gamescrubs"));

(function (module) {
    'use strict';

    var MainController = function ($scope, $location, $uibModal, $log, $sessionStorage, $state, Bracket, BracketService, ModalManagerService) {



        $scope.search = function(query) {
            $location.path("/bracket/" + query);
        }

        var onValidateBracketsComplete = function (data) {
            if (data.isValid) {
                $sessionStorage.key = data.encrypted;
                $state.go("manage", { id: data.BracketID });
            }
        }

        $scope.openModal = function () {
            var instance = ModalManagerService.openBracketModal(Bracket, "templates/modalBracket.html", "animated zoomIn");

            // Process results
            instance.result.then(function (data) {

                var payLoad = {
                    id: data.ID,
                    code: data.LockCode
                }

                BracketService.unlock(payLoad).$promise.then(onValidateBracketsComplete);

            }, function () {
                console.log('Modal dismissed at: ' + new Date());
            });
        }
    };

    module.controller('MainController', MainController);

})(angular.module("gamescrubs"));

(function (module) {
    'use strict';

    var ViewController = function ($scope, $uibModal, $state, $stateParams, $filter, $sessionStorage, envService,
        Bracket, BracketService, Player, PlayerService, BracketHub) {


        $scope.id = $stateParams.id;

        BracketHub.connect();

        $scope.$on('refresh', function (event, data) {
            $scope.bracket = data;
            $scope.$apply();
        });

        $scope.activeTab = 'winner';

        $scope.isDouble = function (type) {

            if (type === 0 || type === 1 || type === 2)
                return false;

            return true;
        };

        var getBracketData = function()
        {
            BracketService.get({ id: $scope.id }, function (data) {
                $scope.bracket = data;
                $scope.bracket.Players = $filter('orderBy')($scope.bracket.Players, 'Seed');
            });
        }


        var onLoadScoresComplete = function(data) {
            $scope.scores = data;
        }

        $scope.$watch('activeTab', function (value, old) {

            if (value == 'score') {
                $scope.viewScores();
            }
        }, true);

        $scope.viewScores = function() {
            BracketService.viewScore({ id: $scope.id }).$promise.then(onLoadScoresComplete);
        }

        getBracketData();

        $scope.update = function (id) {
            if (id > 0) {
                var payLoad = {
                    bracketId: $scope.bracket.ID,
                    placementId: id,
                    token: $sessionStorage.key
                }

                BracketService.setScore(payLoad, function (data) {
                    getBracketData();
                });
            }
        }
    };

    module.controller('ViewController', ViewController);

})(angular.module("gamescrubs"));

(function (module) {
    'use strict';

    var autoFocus = function ($timeout) {
        return {

            scope: {
                trigger: '@autoFocus'
            },
            link: function (scope, element) {
                scope.$watch('trigger', function (value) {
                    if (value == 'true') {
                        $timeout(function () {
                            element[0].focus();
                        });
                    }
                });
            }
        }
    };

        module.directive("autoFocus", autoFocus);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var environment = function (envService) {
        return {
            templateUrl: "/templates/environment.html",
            controller: function ($scope, envService) {
                $scope.environment = envService.get();
            }
        }
    };

    module.directive("environment", environment);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var setupDom = function(element) {
        var input = element.querySelector("input, textarea, select");
        var type = input.getAttribute("type");
        var name = input.getAttribute("name");

        if (type !== "checkbox" && type !== "radio") {
            if (input) {
                input.classList.add("form-control");
            }
        }

        var label = element.querySelector("label");
        if (label) {
            label.classList.add("control-label");
        }

        element.classList.add("form-group");

        return name;

    };

    var addMessages = function (form, element, name, $compile, scope) {

            var messages = "<div class='help-block' ng-messages='" + form.$name + "." + name + ".$error" +
                "' ng-messages-include='templates/messages.html'></div>";

            var compiled = $compile(messages);
            var content = compiled(scope);
            element.append(content);
    };

    var link = function ($compile) {
        return function(scope, element, attributes, form) {
            var name = setupDom(element[0]);
            //addMessages(form, element, name, $compile, scope);
        };
    };

    var forminput = function ($compile) {
        return {
            restrict: "A",
            link: link($compile),
            require: "^form"
        }
    };

    module.directive("forminput", forminput);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var link = function ($compile) {

        return function (scope, element, attributes) {
            var bracketDesign = "";
            var counter = 0;

            var createConnectors = function (num, round) {
                bracketDesign += "<div class='connecter' id='round-" + round + "-connector'>";
                for (var i = 0; i < num; i++) {
                    bracketDesign += "<div></div>";
                }
                bracketDesign += "</div>";
            }

            var createLines = function (num, round) {
                bracketDesign += "<div class='line' id='round-" + round + "-line'>";
                for (var i = 0; i < num; i++) {
                    bracketDesign += "<div></div>";
                }
                bracketDesign += "</div>";
            }

            var createSection = function (num, round) {
                bracketDesign += "<section id='round-" + round + "'>";
                for (var i = 0; i < num; i++) {
                    counter += 1;

                    var player = {
                        name: "",
                        placementId: 0
                    }

                    scope.bracket.Placements.forEach(function (p, i) {

                        if (p.BracketPlace == "w" + counter) {
                            player.name = p.PlayerName;
                            player.placementId = p.ID;
                        }
                    });

                    bracketDesign += "<div ng-click='update(" + player.placementId + ")'>" + player.name + "</div>";
                }
                bracketDesign += "</section>";
            }

            var createBracket = function () {

                var currentRound = 1;
                var currentPlayerNumber = scope.bracket.Players.length;

                while (currentPlayerNumber > 1) {

                    createSection(currentPlayerNumber, currentRound);

                    createConnectors(currentPlayerNumber / 2, currentRound);

                    createLines(currentPlayerNumber / 2, currentRound);

                    currentPlayerNumber = currentPlayerNumber / 2;

                    currentRound += 1;

                }

                if (!scope.isDouble(scope.bracket.Type)) {
                    createSection(1, currentRound);
                } else {

                    // Finals
                    createSection(2, currentRound);
                    createConnectors(1, currentRound);
                    createLines(1, currentRound);

                    // Winner
                    createSection(1, currentRound + 1);
                }

            }

            scope.$watch('bracket', function (newVal, oldVal) {

                bracketDesign = "";
                counter = 0;

                createBracket();

                var content = $compile(bracketDesign)(scope);
                element.replaceWith(content);
                element = content;
            }, true);
        }
    };

    var generateBracket = function ($compile) {
        return {
            link: link($compile)
        }
    };

    module.directive('generateBracket', generateBracket);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var link = function ($compile) {

        return function (scope, element, attributes) {
            var bracketDesign = "";
            var counter = 0;

            var createConnectors = function (num, round) {
                bracketDesign += "<div class='loser-connecter' id='loser-round-" + round + "-connector'>";
                for (var i = 0; i < num; i++) {
                    bracketDesign += "<div></div>";
                }
                bracketDesign += "</div>";
            }

            var createLines = function (num, round) {
                bracketDesign += "<div class='loser-line' id='loser-round-" + round + "-line'>";
                for (var i = 0; i < num; i++) {
                    bracketDesign += "<div></div>";
                }
                bracketDesign += "</div>";
            }

            var createFinalSection = function (num, round) {
                bracketDesign += "<section id='loser-round-" + round + "'>";
                for (var i = 0; i < num; i++) {
                    counter += 1;

                    var player = {
                        name: "",
                        placementId: 0
                    }

                    scope.bracket.Placements.forEach(function (p, i) {

                        if (p.PreviousBracketPlace == "l" + counter && p.IsTop == false || p.PreviousBracketPlace == "l" + (counter -1) && p.IsTop == true) {
                            player.name = p.PlayerName;
                            player.placementId = p.ID;
                        }
                    });

                    bracketDesign += "<div>" + player.name + "</div>";
                }
                bracketDesign += "</section>";
            }

            var createSection = function (num, round) {
                bracketDesign += "<section id='loser-round-" + round + "'>";
                for (var i = 0; i < num; i++) {
                    counter += 1;

                    var player = {
                        name: "",
                        placementId: 0
                    }

                    scope.bracket.Placements.forEach(function (p, i) {

                        if (p.BracketPlace == "l" + counter) {
                            player.name = p.PlayerName;
                            player.placementId = p.ID;
                        }
                    });

                    bracketDesign += "<div ng-click='update(" + player.placementId + ")'>" + player.name + "</div>";
                }
                bracketDesign += "</section>";
            }

            var isEven = function(n)
            {
                return n % 2 == 0;
            }

            var createBracket = function () {

                var currentRound = 0;
                var currentPlayerNumber = scope.bracket.Players.length / 2;

                while (currentPlayerNumber > 1) {

                    currentRound += 1;

                    createSection(currentPlayerNumber, currentRound);

                    createConnectors(currentPlayerNumber / 2, currentRound);

                    createLines(currentPlayerNumber / 2, currentRound);

                    if (isEven(currentRound) === true) {
                        currentPlayerNumber = currentPlayerNumber / 2;
                    }
                }


                // Final
                counter = counter - 1;
                createFinalSection(1, currentRound + 1);
            }

            scope.$watch('bracket', function (newVal, oldVal) {

                bracketDesign = "";
                counter = 0;

                createBracket();

                var content = $compile(bracketDesign)(scope);
                element.replaceWith(content);
                element = content;
            }, true);
        }
    };

    var generateLosersBracket = function ($compile) {
        return {
            link: link($compile)
        }
    };

    module.directive('generateLosersBracket', generateLosersBracket);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var playersLayout = function () {
        return {
            templateUrl: "/templates/players.html",
            controller: "BracketController"

        }
    };

    module.directive("playersLayout", playersLayout);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var scoreLayout = function () {
        return {
            templateUrl: "/templates/scores.html",
            controller: "ViewController"

        }
    };

    module.directive("scoreLayout", scoreLayout);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var search = function () {
        return {
            templateUrl: "/templates/search.html",
            controller: "MainController"

        }
    };

    module.directive("search", search);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var Bracket = function() {
        return{
            ID: 0,
            Name: '',
            Game: '',
            Url: '',
            Email: '',
            LockCode: '',
            isLocked: false,
            Type: 0,
            Status: 0,
            Competition: 0,
            Players: [],
            Placements: [],
            StartDate: null,
            CreatedDate: null
        }
    };

    module.factory('Bracket', Bracket);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    module.factory('BracketHub', function ($, $rootScope, envService) {

        var proxy;
        var connection;
        var apiUrl = envService.read('apiUrl');

        return {
            connect: function () {

                connection = $.hubConnection(apiUrl + "/signalr");
                connection.logging = false;

                $.connection.hub.url = apiUrl + "/signalr";

                proxy = connection.createHubProxy('bracketsHub');

                proxy.on('refresh', function (data) {
                    $rootScope.$broadcast('refresh', data);
                });

                connection.start()
                    .done(function () { console.log('Now connected, connection ID=' + connection.id); })
                    .fail(function () { console.log('Could not connect'); });


            },
            isConnecting: function () {
                return connection.state === 0;
            },
            isConnected: function () {
                return connection.state === 1;
            },
            connectionState: function () {
                return connection.state;
            },
            refresh: function (bracket) {
                proxy.invoke('refresh', bracket);
            },
        }
    });

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    module.factory('BracketService', function ($resource, envService) {


        var apiUrl = envService.read('apiUrl');


        return $resource(apiUrl + '/bracket/:id', { id: '@id' }, {
            update: {
                url: apiUrl + '/bracket',
                method: 'PUT'
            },
            delete: {
                url: apiUrl + '/bracket',
                method: 'DELETE'
            },
            unlock: {
                url: apiUrl + '/bracket/lock/',
                method: 'POST',
                isArray: false
            },
            validate: {
                url: apiUrl + '/bracket/lock/validate',
                    method: 'POST',
                    isArray: false
            },
            status: {
                url: apiUrl + '/bracket/status',
                method: 'POST',
                isArray: false
            },
            setScore: {
                url: apiUrl + '/bracket/score',
                method: 'POST',
                isArray: true
            },
            viewScore: {
                url: apiUrl + '/bracket/score/:id',
                method: 'GET',
                isArray: false
            },
            placements: {
                url: apiUrl + '/bracket/placement/:id',
                method: 'GET',
                isArray: true
            }
        });
    });

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var ModalManagerService = function ($uibModal) {

        return {
            openBracketModal: function(bracketObject, templateLink, windowAnimation) {

                var modalObj = $uibModal.open({
                    templateUrl: templateLink,
                    backdrop: 'static',
                    windowClass: windowAnimation,
                    controller: function ($scope, $filter, $uibModalInstance, $sessionStorage, bracket, BracketService) {

                        $scope.bracket = bracket;

                        $scope.convertToInt = function(id) {
                            return parseInt(id, 10);
                        };

                        $scope.bracket.StartDate = $filter('date')($scope.bracket.StartDate, 'MM/dd/yyyy');

                        $scope.submitForm = function() {

                            console.log($scope.bracket);

                            if ($scope.bracket.ID > 0) {
                                var payLoad = {
                                    bracket: $scope.bracket,
                                    token: $sessionStorage.key
                                }

                                BracketService.update(payLoad, function (responseData) {
                                    $scope.bracket = responseData;
                                    $uibModalInstance.close(responseData);
                                });

                            } else {

                                BracketService.save({}, $scope.bracket, function (responseData) {
                                    $scope.bracket = responseData;
                                    $uibModalInstance.close(responseData);
                                });
                            }
                        }

                        $scope.cancel = function() {
                            $uibModalInstance.dismiss('cancel');
                        }
                    },
                    resolve: {
                        bracket: function() {
                            return bracketObject;
                        }
                    }
                });

                return modalObj;
            },

            openPlayerModal: function(playerObject, templateLink, windowAnimation) {

                var modalObj = $uibModal.open({
                    templateUrl: templateLink,
                    backdrop: 'static',
                    windowClass: windowAnimation,
                    controller: function ($scope, $filter, $uibModalInstance, $sessionStorage, player, PlayerService) {

                        $scope.player = player;

                        $scope.submitForm = function() {

                            var payLoad = {
                                player: $scope.player,
                                token: $sessionStorage.key
                            }

                            var playerService = new PlayerService(payLoad);

                            if ($scope.player.ID > 0) {
                                playerService.$update(function(responseData) {
                                    $scope.player = responseData;
                                    $uibModalInstance.close(responseData);
                                });
                            } else {
                                playerService.$save(function (responseData) {
                                    $scope.player = responseData;
                                    $uibModalInstance.close(responseData);
                                });
                            }
                        }

                        $scope.cancel = function() {
                            $uibModalInstance.dismiss('cancel');
                        }
                    },
                    resolve: {
                        player: function() {
                            return playerObject;
                        }
                    }
                });

                return modalObj;
            },

            openStatusModal: function (bracketObject, templateLink, windowAnimation) {

                var modalObj = $uibModal.open({
                    templateUrl: templateLink,
                    backdrop: 'static',
                    windowClass: windowAnimation,
                    controller: function ($scope, $filter, $uibModalInstance, $sessionStorage, bracket, BracketService) {

                        $scope.bracket = bracket;

                        $scope.convertToInt = function (id) {
                            return parseInt(id, 10);
                        };

                        $scope.submitForm = function () {

                            var payLoad = {
                                bracketId: $scope.bracket.ID,
                                status: $scope.bracket.Status,
                                token: $sessionStorage.key
                            }

                            BracketService.status(payLoad);

                            $uibModalInstance.close();
                        }

                        $scope.cancel = function () {
                            $uibModalInstance.dismiss('cancel');
                        }
                    },
                    resolve: {
                        bracket: function () {
                            return bracketObject;
                        }
                    }
                });

                return modalObj;
            },
        }
    };

    module.factory('ModalManagerService', ModalManagerService);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    var Player = function() {
        return {
            ID: 0,
            BracketID: 0,
            PlayerName: '',
            Seed: 0,
            Score: 0
        }
    };

    module.service('Player', Player);

})(angular.module('gamescrubs'));
(function (module) {
    'use strict';

    module.factory('PlayerService',  function ($resource, envService) {

        var apiUrl = envService.read('apiUrl');

        return $resource(apiUrl + '/player/:id', { id: '@id' }, {
            all: {
                url: apiUrl + '/players/:id',
                method: 'GET',
                isArray: true
            },
            order: {
                url: apiUrl + '/player/reorder',
                method: 'POST',
                isArray: true
            },
            update: {
                method: 'PUT'
            }
        });
    });

})(angular.module('gamescrubs'));

