import { METHOD, STATUS_CODE } from "../../../support/api/api-const";
import API from "../../../support/ApiUrls";
import * as Authorization from "../../../support/authorization";


context('Settings', { tags: ['settings', 'thirdPool', 'all'] }, () => {
    const SRUsername = Cypress.env('SRUser');
    it('Set settings', { tags: ['smoke'] }, () => {
        Authorization.getAccessToken(SRUsername).then((authorization) => {
            cy.request({
                method: METHOD.POST,
                url: API.ApiServer + 'settings',
                headers: {
                    authorization,
                },
                body: {
                    operatorId: Cypress.env('operatorId'),
                    operatorKey: Cypress.env('operatorKey'),
                    ipfsStorageApiKey: "MgCb5tPXmHbsUWvnBbr3eNzea/ZKSEPFptgIr4+EVZbdr8+0B1OrGjzPzGN5IZLpsEUa4A8F9OXt0u4ygq8FqxRygyfU=;EaJlcm9vdHOAZ3ZlcnNpb24BuAIBcRIgzVZTgwgsBIaqT6lUafXCN3spUgXEXnTaz2Jq9/SQUrqo YXNYRO2hA0DmuM6XvsrIQQu2RATvreLk7bm31hapyW347+T3rWQBMOcjTfoEhOVntPtYyQz1ZkJE tJyaIPdykrywe/1/fQwOYXZlMC45LjFjYXR0gaJjY2FuYSpkd2l0aHg4ZGlkOmtleTp6Nk1rcHQz cWREekQ3Tjh3U2YzYUY2elppU1F4RVRhaUJzMlNkd1dySlQxTkZmRUJjYXVkWCedGm1haWx0bzpn bWFpbC5jb206a2lyaWxsLnRvbG9jaGtvLndvcmtjZXhw9mNmY3SBoWVzcGFjZaFkbmFtZWZLaXJp bGxjaXNzWCLtAZrulnhRElDypjvnw+OSxURsmbNtQ/Gj31+IC3qC5JbUY3ByZoDKAgFxEiCv0CfB NvoyJuJTLVCtkfrTz2AfMnYK2sk5tfgkBNBbhKhhc0SAoAMAYXZlMC45LjFjYXR0gaJjY2FuYSpk d2l0aGZ1Y2FuOipjYXVkWCLtAQO0TzmkdqahmgGMrgrQAgtVffhM4uWX/rYMcFysURr+Y2V4cPZj ZmN0gaJuYWNjZXNzL2NvbmZpcm3YKlglAAFxEiA8C94cqYkCCExoBi43a71okx/44f2J9t8WHeaq dDSzZG5hY2Nlc3MvcmVxdWVzdNgqWCUAAXESID+egw19pkJfWLsUKYeXjknwpdAiEYgZ1Yyh/Wle bGegY2lzc1gnnRptYWlsdG86Z21haWwuY29tOmtpcmlsbC50b2xvY2hrby53b3JrY3ByZoHYKlgl AAFxEiDNVlODCCwEhqpPqVRp9cI3eylSBcRedNrPYmr39JBSurgCAXESIM1WU4MILASGqk+pVGn1 wjd7KVIFxF502s9iavf0kFK6qGFzWETtoQNA5rjOl77KyEELtkQE763i5O25t9YWqclt+O/k961k ATDnI036BITlZ7T7WMkM9WZCRLScmiD3cpK8sHv9f30MDmF2ZTAuOS4xY2F0dIGiY2NhbmEqZHdp dGh4OGRpZDprZXk6ejZNa3B0M3FkRHpEN044d1NmM2FGNnpaaVNReEVUYWlCczJTZHdXckpUMU5G ZkVCY2F1ZFgnnRptYWlsdG86Z21haWwuY29tOmtpcmlsbC50b2xvY2hrby53b3JrY2V4cPZjZmN0 gaFlc3BhY2WhZG5hbWVmS2lyaWxsY2lzc1gi7QGa7pZ4URJQ8qY758PjksVEbJmzbUPxo99fiAt6 guSW1GNwcmaAygIBcRIgr9AnwTb6MibiUy1QrZH6089gHzJ2CtrJObX4JATQW4SoYXNEgKADAGF2 ZTAuOS4xY2F0dIGiY2NhbmEqZHdpdGhmdWNhbjoqY2F1ZFgi7QEDtE85pHamoZoBjK4K0AILVX34 TOLll/62DHBcrFEa/mNleHD2Y2ZjdIGibmFjY2Vzcy9jb25maXJt2CpYJQABcRIgPAveHKmJAghM aAYuN2u9aJMf+OH9ifbfFh3mqnQ0s2RuYWNjZXNzL3JlcXVlc3TYKlglAAFxEiA/noMNfaZCX1i7 FCmHl45J8KXQIhGIGdWMof1pXmxnoGNpc3NYJ50abWFpbHRvOmdtYWlsLmNvbTpraXJpbGwudG9s b2Noa28ud29ya2NwcmaB2CpYJQABcRIgzVZTgwgsBIaqT6lUafXCN3spUgXEXnTaz2Jq9/SQUrq4 AgFxEiDNVlODCCwEhqpPqVRp9cI3eylSBcRedNrPYmr39JBSuqhhc1hE7aEDQOa4zpe+yshBC7ZE BO+t4uTtubfWFqnJbfjv5PetZAEw5yNN+gSE5We0+1jJDPVmQkS0nJog93KSvLB7/X99DA5hdmUw LjkuMWNhdHSBomNjYW5hKmR3aXRoeDhkaWQ6a2V5Ono2TWtwdDNxZER6RDdOOHdTZjNhRjZ6WmlT UXhFVGFpQnMyU2R3V3JKVDFORmZFQmNhdWRYJ50abWFpbHRvOmdtYWlsLmNvbTpraXJpbGwudG9s b2Noa28ud29ya2NleHD2Y2ZjdIGhZXNwYWNloWRuYW1lZktpcmlsbGNpc3NYIu0Bmu6WeFESUPKm O+fD45LFRGyZs21D8aPfX4gLeoLkltRjcHJmgMoCAXESIK/QJ8E2+jIm4lMtUK2R+tPPYB8ydgra yTm1+CQE0FuEqGFzRICgAwBhdmUwLjkuMWNhdHSBomNjYW5hKmR3aXRoZnVjYW46KmNhdWRYIu0B A7RPOaR2pqGaAYyuCtACC1V9+Ezi5Zf+tgxwXKxRGv5jZXhw9mNmY3SBom5hY2Nlc3MvY29uZmly bdgqWCUAAXESIDwL3hypiQIITGgGLjdrvWiTH/jh/Yn23xYd5qp0NLNkbmFjY2Vzcy9yZXF1ZXN0 2CpYJQABcRIgP56DDX2mQl9YuxQph5eOSfCl0CIRiBnVjKH9aV5sZ6BjaXNzWCedGm1haWx0bzpn bWFpbC5jb206a2lyaWxsLnRvbG9jaGtvLndvcmtjcHJmgdgqWCUAAXESIM1WU4MILASGqk+pVGn1 wjd7KVIFxF502s9iavf0kFK6uAIBcRIgzVZTgwgsBIaqT6lUafXCN3spUgXEXnTaz2Jq9/SQUrqo YXNYRO2hA0DmuM6XvsrIQQu2RATvreLk7bm31hapyW347+T3rWQBMOcjTfoEhOVntPtYyQz1ZkJE tJyaIPdykrywe/1/fQwOYXZlMC45LjFjYXR0gaJjY2FuYSpkd2l0aHg4ZGlkOmtleTp6Nk1rcHQz cWREekQ3Tjh3U2YzYUY2elppU1F4RVRhaUJzMlNkd1dySlQxTkZmRUJjYXVkWCedGm1haWx0bzpn bWFpbC5jb206a2lyaWxsLnRvbG9jaGtvLndvcmtjZXhw9mNmY3SBoWVzcGFjZaFkbmFtZWZLaXJp bGxjaXNzWCLtAZrulnhRElDypjvnw+OSxURsmbNtQ/Gj31+IC3qC5JbUY3ByZoDKAgFxEiCv0CfB NvoyJuJTLVCtkfrTz2AfMnYK2sk5tfgkBNBbhKhhc0SAoAMAYXZlMC45LjFjYXR0gaJjY2FuYSpk d2l0aGZ1Y2FuOipjYXVkWCLtAQO0TzmkdqahmgGMrgrQAgtVffhM4uWX/rYMcFysURr+Y2V4cPZj ZmN0gaJuYWNjZXNzL2NvbmZpcm3YKlglAAFxEiA8C94cqYkCCExoBi43a71okx/44f2J9t8WHeaq dDSzZG5hY2Nlc3MvcmVxdWVzdNgqWCUAAXESID+egw19pkJfWLsUKYeXjknwpdAiEYgZ1Yyh/Wle bGegY2lzc1gnnRptYWlsdG86Z21haWwuY29tOmtpcmlsbC50b2xvY2hrby53b3JrY3ByZoHYKlgl AAFxEiDNVlODCCwEhqpPqVRp9cI3eylSBcRedNrPYmr39JBSurgCAXESIM1WU4MILASGqk+pVGn1 wjd7KVIFxF502s9iavf0kFK6qGFzWETtoQNA5rjOl77KyEELtkQE763i5O25t9YWqclt+O/k961k ATDnI036BITlZ7T7WMkM9WZCRLScmiD3cpK8sHv9f30MDmF2ZTAuOS4xY2F0dIGiY2NhbmEqZHdp dGh4OGRpZDprZXk6ejZNa3B0M3FkRHpEN044d1NmM2FGNnpaaVNReEVUYWlCczJTZHdXckpUMU5G ZkVCY2F1ZFgnnRptYWlsdG86Z21haWwuY29tOmtpcmlsbC50b2xvY2hrby53b3JrY2V4cPZjZmN0 gaFlc3BhY2WhZG5hbWVmS2lyaWxsY2lzc1gi7QGa7pZ4URJQ8qY758PjksVEbJmzbUPxo99fiAt6 guSW1GNwcmaAygIBcRIgr9AnwTb6MibiUy1QrZH6089gHzJ2CtrJObX4JATQW4SoYXNEgKADAGF2 ZTAuOS4xY2F0dIGiY2NhbmEqZHdpdGhmdWNhbjoqY2F1ZFgi7QEDtE85pHamoZoBjK4K0AILVX34 TOLll/62DHBcrFEa/mNleHD2Y2ZjdIGibmFjY2Vzcy9jb25maXJt2CpYJQABcRIgPAveHKmJAghM aAYuN2u9aJMf+OH9ifbfFh3mqnQ0s2RuYWNjZXNzL3JlcXVlc3TYKlglAAFxEiA/noMNfaZCX1i7 FCmHl45J8KXQIhGIGdWMof1pXmxnoGNpc3NYJ50abWFpbHRvOmdtYWlsLmNvbTpraXJpbGwudG9s b2Noa28ud29ya2NwcmaB2CpYJQABcRIgzVZTgwgsBIaqT6lUafXCN3spUgXEXnTaz2Jq9/SQUrq4 AgFxEiDNVlODCCwEhqpPqVRp9cI3eylSBcRedNrPYmr39JBSuqhhc1hE7aEDQOa4zpe+yshBC7ZE BO+t4uTtubfWFqnJbfjv5PetZAEw5yNN+gSE5We0+1jJDPVmQkS0nJog93KSvLB7/X99DA5hdmUw LjkuMWNhdHSBomNjYW5hKmR3aXRoeDhkaWQ6a2V5Ono2TWtwdDNxZER6RDdOOHdTZjNhRjZ6WmlT UXhFVGFpQnMyU2R3V3JKVDFORmZFQmNhdWRYJ50abWFpbHRvOmdtYWlsLmNvbTpraXJpbGwudG9s b2Noa28ud29ya2NleHD2Y2ZjdIGhZXNwYWNloWRuYW1lZktpcmlsbGNpc3NYIu0Bmu6WeFESUPKm O+fD45LFRGyZs21D8aPfX4gLeoLkltRjcHJmgMoCAXESIK/QJ8E2+jIm4lMtUK2R+tPPYB8ydgra yTm1+CQE0FuEqGFzRICgAwBhdmUwLjkuMWNhdHSBomNjYW5hKmR3aXRoZnVjYW46KmNhdWRYIu0B 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 14+oYXNYRO2hA0AjKSEq5VfPj6K5Fo7MbA4asPsG7/cL05bbMFeilRM8E+gtSVZ04/VwdD/9j4BO yh4HYy2Gkk94cDe9ivJLnYgHYXZlMC45LjFjYXR0hqJjY2FuZ3NwYWNlLypkd2l0aHg4ZGlkOmtl eTp6Nk1rcHQzcWREekQ3Tjh3U2YzYUY2elppU1F4RVRhaUJzMlNkd1dySlQxTkZmRUKiY2Nhbmdz dG9yZS8qZHdpdGh4OGRpZDprZXk6ejZNa3B0M3FkRHpEN044d1NmM2FGNnpaaVNReEVUYWlCczJT ZHdXckpUMU5GZkVComNjYW5odXBsb2FkLypkd2l0aHg4ZGlkOmtleTp6Nk1rcHQzcWREekQ3Tjh3 U2YzYUY2elppU1F4RVRhaUJzMlNkd1dySlQxTkZmRUKiY2NhbmhhY2Nlc3MvKmR3aXRoeDhkaWQ6 a2V5Ono2TWtwdDNxZER6RDdOOHdTZjNhRjZ6WmlTUXhFVGFpQnMyU2R3V3JKVDFORmZFQqJjY2Fu amZpbGVjb2luLypkd2l0aHg4ZGlkOmtleTp6Nk1rcHQzcWREekQ3Tjh3U2YzYUY2elppU1F4RVRh aUJzMlNkd1dySlQxTkZmRUKiY2Nhbmd1c2FnZS8qZHdpdGh4OGRpZDprZXk6ejZNa3B0M3FkRHpE N044d1NmM2FGNnpaaVNReEVUYWlCczJTZHdXckpUMU5GZkVCY2F1ZFgi7QHU6saPM/MY3khkumwR RrgDwX05e3S7jKCrwWrFHKDJ9WNleHD2Y2ZjdIGhZXNwYWNloWRuYW1lZktpcmlsbGNpc3NYIu0B A7RPOaR2pqGaAYyuCtACC1V9+Ezi5Zf+tgxwXKxRGv5jcHJmjNgqWCUAAXESIK/QJ8E2+jIm4lMt UK2R+tPPYB8ydgrayTm1+CQE0FuE2CpYJQABcRIgr9AnwTb6MibiUy1QrZH6089gHzJ2CtrJObX4 JATQW4TYKlglAAFxEiCv0CfBNvoyJuJTLVCtkfrTz2AfMnYK2sk5tfgkBNBbhNgqWCUAAXESIK/Q J8E2+jIm4lMtUK2R+tPPYB8ydgrayTm1+CQE0FuE2CpYJQABcRIgr9AnwTb6MibiUy1QrZH6089g HzJ2CtrJObX4JATQW4TYKlglAAFxEiCv0CfBNvoyJuJTLVCtkfrTz2AfMnYK2sk5tfgkBNBbhNgq WCUAAXESIK0u8VglJGaS82NDbfGnSUIwq2jRIJ/FNI5kun1GkH1S2CpYJQABcRIgrS7xWCUkZpLz Y0Nt8adJQjCraNEgn8U0jmS6fUaQfVLYKlglAAFxEiCtLvFYJSRmkvNjQ23xp0lCMKto0SCfxTSO ZLp9RpB9UtgqWCUAAXESIK0u8VglJGaS82NDbfGnSUIwq2jRIJ/FNI5kun1GkH1S2CpYJQABcRIg rS7xWCUkZpLzY0Nt8adJQjCraNEgn8U0jmS6fUaQfVLYKlglAAFxEiCtLvFYJSRmkvNjQ23xp0lC MKto0SCfxTSOZLp9RpB9Ug=="
                }
            })
                .then((response) => {
                    expect(response.status).to.eq(STATUS_CODE.SUCCESS)
                })
        })
    })
})
