package ca.kindredlink;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.ActiveProfiles;

import ca.kindredlink.business.Business;
import ca.kindredlink.business.BusinessRepository;
import ca.kindredlink.business.CheckinRepository;
import ca.kindredlink.node.NodeRepository;

@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {
	@Autowired
	private DemoData demoData;

	@Autowired
	private NodeRepository nodes;

	@Autowired
	private BusinessRepository businesses;

	@Autowired
	private CheckinRepository checkins;

	@Test
	void contextLoads() {
	}

	@Test
	void demoSeedIsIdempotentAcrossRuns() {
		long nodeCount = nodes.count();
		long businessCount = businesses.count();
		assertTrue(nodeCount > 0, "expected demo nodes to be seeded at startup");
		assertTrue(businessCount > 0, "expected demo businesses to be seeded at startup");

		demoData.run(new DefaultApplicationArguments(new String[0]));
		demoData.run(new DefaultApplicationArguments(new String[0]));

		assertEquals(nodeCount, nodes.count());
		assertEquals(businessCount, businesses.count());
	}

	@Test
	void demoBusinessCatalogMatchesProvidedData() {
		List<Business> all = businesses.findAll();
		assertEquals(2, all.size());

		Business cinnzeo = onlyByName(all, "Cinnzeo Bakery Cafe");
		assertEquals(51.07923, cinnzeo.getLat(), 1e-9);
		assertEquals(-114.127219, cinnzeo.getLng(), 1e-9);
		assertEquals("/images/businesses/cinnzeo-bakery-cafe.png", cinnzeo.getLogoUrl());

		Business lotus = onlyByName(all, "Lotus Fine Indian Cuisine - Charleswood");
		assertEquals(51.087303, lotus.getLat(), 1e-9);
		assertEquals(-114.109781, lotus.getLng(), 1e-9);
		assertEquals("/images/businesses/lotus-charleswood.png", lotus.getLogoUrl());

		// Tokens must be present, unique, and not derivable from the names.
		assertFalse(cinnzeo.getQrToken().isBlank());
		assertFalse(lotus.getQrToken().isBlank());
		assertNotEquals(cinnzeo.getQrToken(), lotus.getQrToken());
		assertEquals(0, checkins.count(), "fresh demo starts with zero participation");
	}

	@Test
	void demoLogosAreBundledPngResources() throws Exception {
		byte[] pngMagic = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A };
		for (String path : List.of(
				"static/images/businesses/cinnzeo-bakery-cafe.png",
				"static/images/businesses/lotus-charleswood.png")) {
			ClassPathResource res = new ClassPathResource(path);
			assertTrue(res.exists(), path + " missing from classpath");
			assertArrayEquals(pngMagic, res.getInputStream().readNBytes(8), path);
		}
	}

	private static Business onlyByName(List<Business> all, String name) {
		List<Business> hits = all.stream().filter(b -> b.getName().equals(name)).toList();
		assertEquals(1, hits.size(), "expected exactly one business named " + name);
		return hits.get(0);
	}

}
