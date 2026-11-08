package ca.kindredlink.chain;

import ca.kindredlink.chain.ChainDtos.ChainStats;
import ca.kindredlink.chain.ChainDtos.ChainTree;
import ca.kindredlink.auth.AuthenticatedAccount;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {id} is the chain id, which is the root node's id (every node carries its chainId). */
@RestController
@RequestMapping("/api/chains")
public class ChainController {

    private final ChainService service;

    public ChainController(ChainService service) {
        this.service = service;
    }

    @GetMapping("/{id}")
    public ChainTree tree(@PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedAccount account) {
        return service.tree(id, account == null ? null : account.identity());
    }

    @GetMapping("/{id}/stats")
    public ChainStats stats(@PathVariable Long id) {
        return service.stats(id);
    }
}
